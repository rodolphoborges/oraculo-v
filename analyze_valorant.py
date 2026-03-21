import json
import sys
import argparse
import random

# Garante que a saída seja sempre em UTF-8
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

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

    # --- DIRETRIZES TÁTICAS K.A.I.O. (Narrativa Localizada) ---
    conselhos = []
    
    # 1. Impacto de Dano (vStats Philosophy)
    if adr < 120:
        conselhos.append("DIRETRIZ_DANO: ADR MUITO BAIXO. TU NÃO TÁ CAUSANDO NADA NO MAPA. ENTRA MAIS NO COMBATE E AJUDA O TIME NAS TROCAS. O ORÁCULO EXIGE IMPACTO.")
    elif adr > 160:
        conselhos.append("EFICIÊNCIA_LETAL: ADR DE QUEM CARREGA. TÁ AMASSANDO GERAL NO COMBATE. MANTÉM DITANDO O RITMO DO JOGO.")

    # 2. Iniciativa (First Bloods)
    if first_kills_count >= 3:
        conselhos.append("OBJETIVO_ADQUIRIDO: TÁ REPRESENTANDO NOS FIRST BLOODS. CONTINUA ABRINDO O MAPA, MAS CUIDADO PRA NÃO TROLLAR A VANTAGEM COM EXCESSO DE CONFIANÇA.")
    elif first_kills_count == 0 and adr < 130:
        conselhos.append("POSTURA_PASSIVA: ZERO FIRST BLOODS? O PROTOCOLO V NÃO ACEITA 'MEDINHO'. BOTA O ROSTO E AJUDA A ABRIR O SITE.")

    # 3. Sobrevivência e Tática (Rádio Limpo / Sinergia)
    deaths = stats['deaths']['value']
    if deaths > total_rounds * 0.9 and actual_kd < 0.8:
        conselhos.append("LOGÍSTICA_ISOLADA: MUITAS MORTES SEM TRADE. JOGA JUNTO COM O TIME, SINERGIA GANHA JOGO, INDIVIDUALIDADE SÓ GANHA FRAG.")
    elif actual_kd > 1.5 and adr < 130:
        conselhos.append("SÍNDROME_DE_KDA: K/D BONITO MAS NÃO TÁ DANDO DANO. PARA DE JOGAR PELO EXIT FRAG E VAI PRO COMBATE REAL.")

    # 4. Fallback Geral
    if not conselhos:
        conselhos.append("FOCO_OPERACIONAL: JOGOU O FEIJÃO COM ARROZ. DESEMPENHO EQUILIBRADO. MANTÉM A DISCIPLINA QUE O RESULTADO VEM.")

    # Seleciona o conselho mais prioritário (ou o primeiro)
    conselho_final = conselhos[0]

    perf_idx = (actual_kd / target_kd) * 100 if target_kd > 0 else 100
    return {
        "player": target_player, "agent": agent_name, "map": map_name, "map_details": map_details,
        "acs": acs, "adr": adr, "kd": actual_kd, "meta_kd": target_kd,
        "first_bloods": first_kills_count,
        "conselho_kaio": conselho_final,
        "performance_index": round(perf_idx, 1),
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
