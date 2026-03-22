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

def analyze_match(json_data, target_player, target_kd=1.0):
    data = json.loads(json_data)
    match_metadata = data['data']['metadata']
    map_name = match_metadata['mapName']
    total_rounds = match_metadata['rounds']
    map_details = match_metadata.get('mapDetails', {})
    
    segments = data['data']['segments']
    player_summary = next((s for s in segments if s['type'] == 'player-summary' and s['attributes']['platformUserIdentifier'].upper() == target_player.upper()), None)
    
    if not player_summary:
        return {"error": "Jogador não encontrado no resumo da partida."}

    agent_name = player_summary['metadata']['agentName']
    stats = player_summary['stats']
    acs = stats['score']['value'] / total_rounds
    adr = stats['damage']['value'] / total_rounds
    actual_kd = stats['kills']['value'] / max(1, stats['deaths']['value'])
    
    player_target_upper = target_player.upper()
    player_round_segs = [s for s in segments if s['type'] == 'player-round' and s['attributes']['platformUserIdentifier'].upper() == player_target_upper]
    all_kill_segs = [s for s in segments if s['type'] == 'player-round-kills']
    round_summaries = {s['attributes']['round']: s['metadata'] for s in segments if s['type'] == 'round-summary'}

    player_agents = {}
    player_meta = player_summary.get('metadata', {})
    player_team = player_meta.get('teamId', 'Unknown')
    for seg in segments:
        if seg['type'] in ['player-summary', 'player-round']:
            pid = seg['attributes']['platformUserIdentifier']
            agent = seg['metadata'].get('agentName', 'Unknown')
            player_agents[pid.upper()] = agent

    # Cálculo de First Bloods (FB)
    first_kills_count = 0
    for r_num in range(1, total_rounds + 1):
        round_kills = sorted(
            [k for k in all_kill_segs if k['attributes']['round'] == r_num],
            key=lambda x: x['metadata'].get('roundTime', 0)
        )
        if round_kills:
            first_kill = round_kills[0]
            if first_kill['attributes']['platformUserIdentifier'].upper() == player_target_upper:
                first_kills_count += 1

    # Templates de Mensagem Principal (Abrasileirado & Valorant Style)
    POS_TEMPLATES = [
        "Mandou {victim_agent} de arrasta com {weapon} aos {time}.",
        "Amassou no domínio de espaço com {weapon} contra {victim_agent}.",
        "Abriu o round deitando {victim_agent} aos {time}.",
        "Aula de mira com {weapon} pra cima de {victim_agent}.",
        "Segurou o rush inimigo aos {time} com {weapon}."
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

        # Ordenação final dos fatos
        narrative_events.sort(key=lambda x: x['ms'])

        rounds_analysis.append({
            "round": r_num,
            "pos": pos_label,
            "neg": neg_label,
            "narrative": narrative_events,
            "tactical_events": tactical_events
        })

    # --- DIRETRIZES TÁTICAS K.A.I.O. (Alinhamento Constitucional & Elucidativo) ---
    conselhos = []
    
    # 1. Artigo 1: O Dano é Absoluto (ADR)
    if adr < 125:
        conselhos.append("VIOLAÇÃO DO ARTIGO 1: ADR ABAIXO DO LIMITE TÁTICO. No Protocolo V e na vStats, o DANO é a métrica absoluta de impacto. Sua presença no mapa não está gerando pressão real. Priorize trocas agressivas e trade-kills imediatos; se você não está causando dano, você está apenas assistindo o time perder.")
    elif adr > 165:
        conselhos.append("CUMPRIMENTO DO ARTIGO 1: EFICIÊNCIA LETAL IDENTIFICADA. Seu ADR está em nível de elite, garantindo que cada round seu resulte em impacto direto na economia inimiga. O Oráculo reconhece sua letalidade absoluta.")

    # 2. Artigo 2: Iniciativa e Reconhecimento (First Bloods)
    if first_kills_count >= 3:
        conselhos.append("CUMPRIMENTO DO ARTIGO 2: EXCELÊNCIA EM INICIATIVA. Você está garantindo a vantagem numérica logo no início. Continue abrindo o mapa e criando janelas de oportunidade para o time. Domínio de espaço é o primeiro passo para a vitória.")
    elif first_kills_count == 0 and adr < 130:
        conselhos.append("VIOLAÇÃO DO ARTIGO 2: POSTURA PASSIVA/HESITANTE. Zero First Bloods aliados a baixo dano indicam que você está jogando com 'medinho'. O Protocolo V exige predação. Se você não abrir o caminho ou trocar o primeiro frag, o reset operacional será inevitável.")

    # 3. Artigo 3: Sinergia e Trocas (Trade Kills / Radio Limpo / Sinergia)
    deaths = stats['deaths']['value']
    if deaths > total_rounds * 0.85 and actual_kd < 0.85:
        conselhos.append("VIOLAÇÃO DO ARTIGO 3: COLAPSO DE SINERGIA. Muitas mortes sem trade (troca) sugerem que você está jogando isolado ou sem comunicação. No Protocolo V, jogar sozinho é um erro tático grave. Cole em um aliado, use o rádio e não deixe sua morte ser em vão.")
    elif actual_kd > 1.6 and adr < 135:
        conselhos.append("ALERTA DE DESVIO: SÍNDROME DE KDA. Seu K/D está alto, mas o ADR está baixo — isso cheira a 'Exit Frags' (matar quando o round já acabou). Honre os artigos: saia da zona de conforto, vá pro combate real e cause dano quando ele realmente importa.")

    # 4. Fallback Geral (Estado de Reset)
    if not conselhos:
        conselhos.append("FOCO_OPERACIONAL: DESEMPENHO DENTRO DOS PARÂMETROS CONSTITUCIONAIS. Você manteve a disciplina e cumpriu sua função básica. O Oráculo segue monitorando sua evolução técnica. Mantenha a constância.")

    # Seleciona o conselho mais prioritário (ou o primeiro)
    conselho_final = conselhos[0]

    # Cálculo de Performance Ponderado (vStats Style: Impacto > KDA)
    # Peso: 40% K/D vs Meta, 60% ADR vs Baseline (135)
    kd_perf = (actual_kd / target_kd) if target_kd > 0 else 1.0
    adr_perf = (adr / 135.0) # Baseline médio de impacto
    perf_idx = (kd_perf * 0.4 + adr_perf * 0.6) * 100
    
    return {
        "player": target_player, "agent": agent_name, "map": map_name, "map_details": map_details,
        "acs": acs, "adr": adr, "kd": actual_kd, "meta_kd": target_kd,
        "first_bloods": first_kills_count,
        "conselho_kaio": conselho_final,
        "performance_index": float(round(perf_idx, 1)),
        "performance_status": "ABOVE_BASELINE" if actual_kd >= target_kd else "BELOW_BASELINE",
        "total_rounds": total_rounds,
        "rounds": rounds_analysis
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", required=True)
    parser.add_argument("--player", required=True)
    parser.add_argument("--target-kd", type=float, default=1.0)
    args = parser.parse_args()
    try:
        with open(args.json, 'r', encoding='utf-8') as f:
            content = f.read()
        print(json.dumps(analyze_match(content, args.player, args.target_kd), indent=2, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
