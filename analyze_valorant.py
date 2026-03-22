"""
analyze_valorant.py

The core tactical analysis engine for Oráculo V.
This script processes raw match JSON data and generates a detailed tactical report
based on Protocolo-V's "Lexicon of Impact" (ADR, FB, Sinergia, etc.).

Inputs:
- JSON file path (via command line argument)
- Player Riot ID (via --player argument)
- Target K/D (optional, via --target-kd argument)

Outputs:
- Structured JSON report to stdout.
"""
import json
import sys
import argparse
import random

# Garante que a saída seja UTF-8
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except:
        pass

def analyze_match(json_data, target_player, target_kd=1.0, agent_name=None, map_name=None, total_rounds=None, team_id=None, holt_prev={}):
    data = json.loads(json_data)
    match_metadata = data['data']['metadata']
    
    # Use provided metadata or fallback to extraction
    curr_map = map_name or match_metadata['mapName']
    curr_rounds = total_rounds or match_metadata['rounds']
    map_details = match_metadata.get('mapDetails', {})
    
    segments = data['data']['segments']
    player_target_upper = target_player.upper()
    player_summary = next((s for s in segments if s['type'] == 'player-summary' and s['attributes']['platformUserIdentifier'].upper() == player_target_upper), None)
    
    if not player_summary:
        return {"error": "Jogador não encontrado no resumo da partida."}

    curr_agent = agent_name or player_summary['metadata']['agentName']
    stats = player_summary['stats']
    acs = stats['score']['value'] / curr_rounds
    adr = stats['damage']['value'] / curr_rounds
    actual_kd = stats['kills']['value'] / max(1, stats['deaths']['value'])
    
    player_round_segs = [s for s in segments if s['type'] == 'player-round' and s['attributes']['platformUserIdentifier'].upper() == player_target_upper]
    all_kill_segs = [s for s in segments if s['type'] == 'player-round-kills']
    round_summaries = {s['attributes']['round']: s['metadata'] for s in segments if s['type'] == 'round-summary'}

    player_agents = {}
    player_team = team_id or player_summary.get('metadata', {}).get('teamId', 'Unknown')
    for seg in segments:
        if seg['type'] in ['player-summary', 'player-round']:
            pid = seg['attributes']['platformUserIdentifier']
            agent = seg['metadata'].get('agentName', 'Unknown')
            player_agents[pid.upper()] = agent

    # Cálculo de First Bloods (FB)
    first_kills_count = 0
    for r_num in range(1, curr_rounds + 1):
        round_kills = sorted(
            [k for k in all_kill_segs if k['attributes']['round'] == r_num],
            key=lambda x: x['metadata'].get('roundTime', 0)
        )
        if round_kills:
            first_kill = round_kills[0]
            if first_kill['attributes']['platformUserIdentifier'].upper() == player_target_upper:
                first_kills_count += 1

    # Templates de Mensagem Principal
    POS_TEMPLATES = [
        "Mandou {victim_agent} de arrasta com {weapon} aos {time}.",
        "Amassou no domínio de espaço com {weapon} contra {victim_agent}.",
        "Abriu o round deitando {victim_agent} aos {time}.",
        "Aula de mira com {weapon} pra cima de {victim_agent}.",
        "Segurou o rush inimigo aos {time} with {weapon}."
    ]
    
    NEG_TEMPLATES = [
        "Foi de base pra {killer_agent} ({weapon}) no contrapé aos {time}.",
        "Perdeu a troca direta contra {killer_agent} (Dano: {damage}).",
        "Pego dormindo (fora de posição) aos {time}.",
        "Tomou um sacode de {killer_agent} ({weapon}) aos {time}.",
        "Ficou isolado aos {time} e foi punido sem trade."
    ]

    rounds_analysis = []
    for r_num in range(1, total_rounds + 1):
        round_seg = next((s for s in player_round_segs if s['attributes']['round'] == r_num), None)
        if not round_seg: continue

        r_stats = round_seg['stats']
        kills_count = r_stats['kills']['value']
        deaths_count = r_stats['deaths']['value']
        dmg = r_stats['damage']['value']
        economy = r_stats['loadoutValue']['value']

        tactical_events = []
        round_kills = sorted(
            [k for k in all_kill_segs if k['attributes']['round'] == r_num],
            key=lambda x: x['metadata'].get('roundTime', 0)
        )
        
        pos_label = None
        neg_label = None
        narrative_events = []

        for k in round_kills:
            k_meta = k['metadata']
            k_attr = k['attributes']
            killer_id = k_attr['platformUserIdentifier']
            victim_id = k_attr['opponentPlatformUserIdentifier']
            
            rt_ms = k_meta.get('roundTime', 0)
            time_str = f"{rt_ms//60000}:{(rt_ms%60000)//1000:02d}"
            weapon = k_meta.get('weaponName', 'Unknown')
            damage = k.get('stats', {}).get('damage', {}).get('value', 0)

            event = {
                "killer_agent": player_agents.get(killer_id.upper(), 'Unknown'),
                "victim_agent": player_agents.get(victim_id.upper(), 'Unknown'),
                "weapon": weapon, "time": time_str, "time_ms": rt_ms,
                "is_player_killer": killer_id.upper() == player_target_upper,
                "is_player_victim": victim_id.upper() == player_target_upper
            }

            if event["is_player_killer"] or event["is_player_victim"]:
                tactical_events.append(event)
                ctx = {"victim_agent": event["victim_agent"], "killer_agent": event["killer_agent"], "weapon": weapon, "time": time_str, "damage": damage}
                
                if event["is_player_killer"]:
                    pos_label = random.choice(POS_TEMPLATES).format(**ctx)
                    narrative_events.append({"time": time_str, "type": "pos", "text": f"Garantiu o frag no {event['victim_agent']} ({weapon})", "ms": rt_ms})
                else:
                    neg_label = random.choice(NEG_TEMPLATES).format(**ctx)
                    narrative_events.append({"time": time_str, "type": "neg", "text": f"Foi de base para {event['killer_agent']} ({weapon})", "ms": rt_ms})

        r_sum = round_summaries.get(r_num)
        if r_sum:
            if r_sum.get('plant') and r_sum['plant']['platformUserIdentifier'].upper() == player_target_upper:
                pos_label = pos_label or "BOMB PLANTED"
                narrative_events.append({"time": "PLAN", "type": "pos", "text": "Dominou o site e garantiu o plant", "ms": r_sum['plant'].get('roundTime', 0)})
            if r_sum.get('defuse') and r_sum['defuse']['platformUserIdentifier'].upper() == player_target_upper:
                pos_label = pos_label or "CLUTCH DEFUSE"
                narrative_events.append({"time": "DEF", "type": "pos", "text": "Clutch no defuse! Garantiu o round no detalhe", "ms": r_sum['defuse'].get('roundTime', 0)})

        if economy < 2500 and kills_count > 0:
            pos_label = pos_label or "ECOOU FORTE"
            narrative_events.insert(0, {"time": "ECO", "type": "pos", "text": f"Fez estrago no Round Eco (Gasto: ${economy})", "ms": -1})

        if deaths_count == 1 and kills_count == 0 and dmg < 50:
            neg_label = neg_label or "PINOU FEIO"
            narrative_events.append({"time": "OUT", "type": "neg", "text": f"Morreu seco sem causar impacto ({int(dmg)} dmg)", "ms": 999999})

        narrative_events.sort(key=lambda x: x['ms'])
        for i in range(len(narrative_events)):
            narrative_events[i]["texto"] = narrative_events[i]["text"]
            narrative_events[i]["tipo"] = narrative_events[i]["type"]

        round_kills_count = sum(1 for e in tactical_events if e["is_player_killer"])
        round_died = any(e["is_player_victim"] for e in tactical_events)
        round_comment = pos_label or neg_label or "Sem eventos críticos registrados."
        round_impacto = "Positivo" if pos_label else ("Negativo" if neg_label else "Neutro")

        rounds_analysis.append({
            "round": r_num, "comment": round_comment, "impacto": round_impacto, "kills": round_kills_count, 
            "died": round_died, "narrative": narrative_events, "eventos": narrative_events, "tactical_events": tactical_events
        })

    # --- Cálculo de Performance Ponderado ---
    kd_perf = (actual_kd / target_kd) if target_kd > 0 else 1.0
    adr_perf = (adr / 135.0)
    perf_idx = (kd_perf * 0.4 + adr_perf * 0.6) * 100
    
    # --- HOLT'S DOUBLE EXPONENTIAL SMOOTHING ---
    α = 0.4 # Level smoothing
    β = 0.2 # Trend smoothing
    
    holt_next = {}
    metrics = {
        "performance": perf_idx,
        "kd": actual_kd,
        "adr": adr
    }
    
    for m, y_t in metrics.items():
        L_prev = holt_prev.get(f"{m}_l")
        T_prev = holt_prev.get(f"{m}_t")
        
        if L_prev is not None and T_prev is not None:
            # Holt formulas
            L_t = α * y_t + (1 - α) * (L_prev + T_prev)
            T_t = β * (L_t - L_prev) + (1 - β) * T_prev
            forecast = L_t + T_t
            holt_next[f"{m}_l"] = round(L_t, 4)
            holt_next[f"{m}_t"] = round(T_t, 4)
            holt_next[f"{m}_forecast"] = round(forecast, 4)
        else:
            # Não inicializado aqui (o worker faz a média das 3 primeiras fora)
            holt_next[f"{m}_l"] = None
            holt_next[f"{m}_t"] = None

    # --- DIRETRIZES TÁTICAS K.A.I.O. (Upgrade Trend-Aware) ---
    conselhos = []
    
    # Check trends if available
    perf_t = holt_next.get("performance_t")
    if perf_t is not None:
        if perf_t > 0.5:
            conselhos.append(f"EVOLUÇÃO DETECTADA: Tendência de melhora robusta (+{perf_t:.1f}% por partida). O Oráculo prevê performance superior no próximo combate ({holt_next['performance_forecast']:.1f}%). Mantenha o ritmo.")
        elif perf_t < -0.5:
            conselhos.append(f"ALERTA DE QUEDA: Tendência de performance negativa identificada ({perf_t:.1f}%). Seu nível técnico está oscilando para baixo. Reavalie sua postura tática antes da próxima partida.")
        
        kd_t = holt_next.get("kd_t", 0)
        adr_t = holt_next.get("adr_t", 0)
        if kd_t > 0 and adr_t < 0:
            conselhos.append("DESBALANCEAMENTO TÁTICO: Seu K/D está subindo mas o ADR está caindo. Cuidado: você está garantindo abates sem gerar pressão real no mapa (Kills de baixo impacto/Exit frags).")
        elif kd_t < 0 and adr_t > 0:
            conselhos.append("INICIATIVA ALTA, BAIXA SOBREVIVÊNCIA: ADR em alta com K/D em queda. Você está causando muito dano mas morrendo sem garantir o frag. Melhore sua finalização e posicionamento pós-troca.")

    # Static Fallbacks (Artigos Constitucionais)
    if adr < 125:
        conselhos.append("VIOLAÇÃO DO ARTIGO 1: ADR ABAIXO DO LIMITE TÁTICO. No Protocolo V, o DANO é a métrica absoluta. Sua presença no mapa não gera pressão real.")
    if first_kills_count >= 3:
        conselhos.append("CUMPRIMENTO DO ARTIGO 2: EXCELÊNCIA EM INICIATIVA. Você está garantindo a vantagem numérica inicial.")
    
    if not conselhos:
        conselhos.append("FOCO_OPERACIONAL: DESEMPENHO DENTRO DOS PARÂMETROS CONSTITUCIONAIS. O Oráculo segue monitorando sua evolução técnica.")

    return {
        "player": target_player, "agent": agent_name, "map": map_name, "map_details": map_details,
        "acs": acs, "adr": adr, "kd": actual_kd, "performance_index": float(round(perf_idx, 1)),
        "holt": holt_next, "conselho_kaio": conselhos[0], "all_conselhos": conselhos,
        "total_rounds": total_rounds, "rounds": rounds_analysis
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", required=True)
    parser.add_argument("--player", required=True)
    parser.add_argument("--target-kd", type=float, default=1.0)
    parser.add_argument("--agent")
    parser.add_argument("--map")
    parser.add_argument("--rounds", type=int)
    parser.add_argument("--team")
    # Holt parameters
    parser.add_argument("--p-l", type=float, help="Prev Perf Level")
    parser.add_argument("--p-t", type=float, help="Prev Perf Trend")
    parser.add_argument("--k-l", type=float, help="Prev KD Level")
    parser.add_argument("--k-t", type=float, help="Prev KD Trend")
    parser.add_argument("--a-l", type=float, help="Prev ADR Level")
    parser.add_argument("--a-t", type=float, help="Prev ADR Trend")
    args = parser.parse_args()
    
    try:
        with open(args.json, 'r', encoding='utf-8') as f:
            content = f.read()
            
        holt_prev = {
            "performance_l": args.p_l, "performance_t": args.p_t,
            "kd_l": args.k_l, "kd_t": args.k_t,
            "adr_l": args.a_l, "adr_t": args.a_t
        }
        
        # Remove keys with None values
        holt_prev = {k: v for k, v in holt_prev.items() if v is not None}

        result = analyze_match(content, args.player, args.target_kd, agent_name=args.agent, map_name=args.map, total_rounds=args.rounds, team_id=args.team, holt_prev=holt_prev)
        print(json.dumps(result, indent=2, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
