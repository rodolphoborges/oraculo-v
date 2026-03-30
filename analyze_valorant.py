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
import math
import traceback

# --- MAPEAMENTO DE AGENTE → FUNÇÃO (Ground Truth) ---
AGENT_ROLE_MAP = {
    # Duelistas
    "jett": "Duelista", "raze": "Duelista", "phoenix": "Duelista",
    "reyna": "Duelista", "yoru": "Duelista", "neon": "Duelista",
    "iso": "Duelista", "waylay": "Duelista",
    # Iniciadores
    "sova": "Iniciador", "breach": "Iniciador", "skye": "Iniciador",
    "kayo": "Iniciador", "kay/o": "Iniciador", "fade": "Iniciador",
    "gekko": "Iniciador", "tejo": "Iniciador",
    # Controladores
    "brimstone": "Controlador", "viper": "Controlador", "omen": "Controlador",
    "astra": "Controlador", "harbor": "Controlador", "clove": "Controlador",
    "miks": "Controlador",
    # Sentinelas
    "sage": "Sentinela", "cypher": "Sentinela", "killjoy": "Sentinela",
    "chamber": "Sentinela", "deadlock": "Sentinela", "vyse": "Sentinela",
    "veto": "Sentinela",
}

# --- THRESHOLDS DINÂMICOS POR FUNÇÃO ---
# Define expectativas e baselines diferentes para cada role.
# Evita cobrar ADR de Sentinela ou KAST de Duelista.
ROLE_THRESHOLDS = {
    "Duelista": {
        "adr_baseline": 150.0,   # ADR alvo para cálculo de perf_idx
        "adr_min": 100,           # Abaixo disso = violação de função
        "kast_min": 60,           # KAST mínimo aceitável
        "fb_excellence": 3,       # Número de FB para "excelência em abertura"
        "fb_min": 1,              # Duelista SEM FB = alerta de função
        "kd_weight": 0.45,
        "adr_weight": 0.55,
        "kast_weight": 0.0,
        "artigo_1_texto": "VIOLAÇÃO CRÍTICA: Duelista com ADR abaixo de 100. Abertura de espaço sem pressão de dano é uma contradição tática.",
        "artigo_2_texto": "EXCELÊNCIA EM ABERTURA: {fb} First Bloods confirmam domínio de duelo e vantagem numérica garantida.",
        "artigo_fb_miss": "ALERTA DE FUNÇÃO: Duelista com {fb} First Blood(s). Quem está abrindo o round se você não está?",
    },
    "Iniciador": {
        "adr_baseline": 100.0,
        "adr_min": 65,
        "kast_min": 68,
        "fb_excellence": 2,
        "fb_min": 0,
        "kd_weight": 0.20,
        "adr_weight": 0.30,
        "kast_weight": 0.50,
        "artigo_1_texto": "ALERTA DE SUPORTE: Iniciador com ADR abaixo de 65. Você está facilitando entradas sem causar nenhum impacto próprio.",
        "artigo_2_texto": "EXCELÊNCIA EM ABERTURA: {fb} First Bloods de um Iniciador confirma sinergia com o time e timing de entrada perfeito.",
        "artigo_kast_miss": "VIOLAÇÃO DE FUNÇÃO: KAST abaixo de {kast_min}% para Iniciador. Suas utilidades devem mantê-lo vivo e ativo em trades.",
    },
    "Controlador": {
        "adr_baseline": 85.0,
        "adr_min": 55,
        "kast_min": 72,
        "fb_excellence": 1,
        "fb_min": 0,
        "kd_weight": 0.15,
        "adr_weight": 0.20,
        "kast_weight": 0.65,
        "artigo_1_texto": "ALERTA: Controlador com ADR extremamente baixo. Mesmo sem ser fragger, sua presença deve criar impacto no mapa.",
        "artigo_2_texto": "CONTROLE TOTAL: {fb} First Blood de Controlador indica excelente leitura de rotação e timing de smoke.",
        "artigo_kast_miss": "VIOLAÇÃO PRIMÁRIA: KAST abaixo de {kast_min}% para Controlador. Suas smokes e utilitários devem manter o time VIVO.",
    },
    "Sentinela": {
        "adr_baseline": 88.0,
        "adr_min": 55,
        "kast_min": 68,
        "fb_excellence": 1,
        "fb_min": 0,
        "kd_weight": 0.15,
        "adr_weight": 0.20,
        "kast_weight": 0.65,
        "artigo_1_texto": "ALERTA DEFENSIVO: Sentinela com ADR muito baixo. Revise suas posições de contenção — você não está causando nenhuma pressão.",
        "artigo_2_texto": "EFICIÊNCIA SURPREENDENTE: Sentinela com First Blood indica excelente leitura de flanco e posicionamento proativo.",
        "artigo_kast_miss": "VIOLAÇÃO DE FUNÇÃO: KAST abaixo de {kast_min}% para Sentinela. Sua função é sobreviver, informar e manter o flanco protegido.",
        "artigo_fd_warning": "PADRÃO PREOCUPANTE: Sentinela com {fd} First Deaths indica saída de posição segura. Você está sendo punido por jogar agressivo?",
    },
}

def resolve_role(agent_name, role_override=None):
    """Resolve o role do jogador pelo nome do agente ou override explícito."""
    if role_override and role_override.lower() != "unknown":
        return role_override
    if agent_name:
        return AGENT_ROLE_MAP.get(agent_name.lower(), "Duelista")
    return "Duelista"

def calculate_performance_index_improved(kd_actual, target_kd, adr, role, kast=None, first_bloods=0):
    """
    Calcula o índice de performance de forma realista e coerente com o Python.
    Base: 100 = exatamente na meta do rank/agente/mapa
    Weights variam por função tática.

    Resultado em escala 0-150 (150 = 50% acima da meta, extremamente raro)
    """
    rt = ROLE_THRESHOLDS.get(role, ROLE_THRESHOLDS["Duelista"])

    # KD Normalization: actual vs target
    kd_perf = (kd_actual / target_kd) if target_kd > 0 else 1.0

    # ADR Normalization: vs role baseline
    adr_perf = adr / rt["adr_baseline"]

    # KAST Normalization: vs 100%
    kast_perf = (kast / 100.0) if kast is not None else 0.7

    # Performance ponderado (apenas com métricas que fazem sentido para a função)
    perf_idx = (
        rt["kd_weight"] * kd_perf * 100 +
        rt["adr_weight"] * adr_perf * 100 +
        rt["kast_weight"] * kast_perf * 100
    )

    return round(perf_idx, 1)

def clean_nan(obj):
    if isinstance(obj, dict):
        return {k: clean_nan(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_nan(v) for v in obj]
    elif isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    return obj

class TemplateManager:
    def __init__(self, templates_json):
        self.templates = {}
        if templates_json:
            try:
                raw_templates = json.loads(templates_json)
                for t in raw_templates:
                    etype = t['event_type']
                    if etype not in self.templates:
                        self.templates[etype] = []
                    self.templates[etype].append(t['template'])
            except:
                pass
            
    def get(self, event_type, default):
        options = self.templates.get(event_type, [])
        if not options:
            return default
        return random.choice(options)

    def format(self, event_type, default, **kwargs):
        # Mapeamento de Sinônimos para maior compatibilidade com o Dump
        synonyms = {
            "first_blood": ["first_blood_positivo", "first_blood"],
            "pos_generic": ["pos_generic", "abate_positivo"],
            "neg_generic": ["neg_generic", "morte_negativa", "morte_boba_negativo"],
            "bomb_planted": ["plant_positivo", "bomb_planted"],
            "bomb_defused": ["defuse_positivo", "bomb_defused"],
        }
        
        target_keys = synonyms.get(event_type, [event_type])
        template = None
        for key in target_keys:
            tpl = self.get(key, None)
            if tpl:
                template = tpl
                break
        
        if not template:
            template = default
        
        if isinstance(template, list):
            template = random.choice(template)
        
        if not template:
            return ""
        # Aliases for compatibility with the dump
        kwargs['local'] = kwargs.get('site', 'Desconhecido')
        kwargs['arma'] = kwargs.get('weapon', 'Desconhecida')
        kwargs['agente_inimigo'] = kwargs.get('victim_agent', kwargs.get('killer_agent', 'Inimigo'))
        kwargs['quantidade'] = kwargs.get('quantidade', 1)
        kwargs['util'] = kwargs.get('weapon', 'Utilidade') # Fallback simple
        
        try:
            return template.format(**kwargs)
        except KeyError as e:
            # Se faltar alguma chave nova, tenta limpar ou retorna o template puro
            return template

# Garante que a saída seja UTF-8
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except (AttributeError, TypeError):
        pass
# Fallback removed for simplicity and compatibility

def analyze_match(json_data, target_player, target_kd=1.0, agent_name=None, map_name=None, total_rounds=None, team_id=None, holt_prev={}, strat_context={}, templates_json=None, role_override=None):
    tm = TemplateManager(templates_json)
    data = json.loads(json_data)
    match_metadata = data['data']['metadata']
    
    # Use provided metadata or fallback to extraction
    curr_map = map_name or match_metadata['mapName']
    curr_rounds = total_rounds or match_metadata['rounds']
    map_details = match_metadata.get('mapDetails', {})
    
    segments = data['data']['segments']
    
    # Normalização para busca resiliente (remove espaços e ignora case)
    player_target_clean = target_player.replace(" ", "").upper()
    player_name_prefix = player_target_clean.split('#')[0]
    
    player_summary = None
    for s in segments:
        if s['type'] != 'player-summary':
            continue
            
        ident = s.get('attributes', {}).get('platformUserIdentifier', '') or \
                s.get('metadata', {}).get('platformUserIdentifier', '')
        
        if not ident:
            continue
            
        ident_clean = ident.replace(" ", "").upper()
        
        # 1. Tentativa de correspondência exata (NAME#TAG)
        if ident_clean == player_target_clean:
            player_summary = s
            break
        
        # 2. Tentativa de correspondência parcial (Apenas NAME) se ainda não encontrou
        if not player_summary and ident_clean.split('#')[0] == player_name_prefix:
            player_summary = s

    if not player_summary:
        return {"error": f"Jogador [{target_player}] não encontrado no resumo da partida."}

    curr_agent = agent_name or player_summary['metadata']['agentName']
    stats = player_summary['stats']
    acs = stats['score']['value'] / curr_rounds
    adr = stats['damage']['value'] / curr_rounds
    actual_kd = stats['kills']['value'] / max(1, stats['deaths']['value'])
    kills_total = int(stats['kills']['value'])
    deaths_total = int(stats['deaths']['value'])
    
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

    # Cálculo de First Bloods (FB) e First Deaths (FD)
    first_kills_count = 0
    first_deaths_count = 0
    for r_num in range(1, curr_rounds + 1):
        round_kills = sorted(
            [k for k in all_kill_segs if k['attributes']['round'] == r_num],
            key=lambda x: x['metadata'].get('roundTime', 0)
        )
        if round_kills:
            first_kill = round_kills[0]
            if first_kill['attributes']['platformUserIdentifier'].upper() == player_target_upper:
                first_kills_count += 1
            elif first_kill['attributes'].get('opponentPlatformUserIdentifier', '').upper() == player_target_upper:
                first_deaths_count += 1

    # Detecção de Vitória (Match Outcome)
    is_win = False
    team_summary = next((s for s in segments if s['type'] == 'team-summary' and s['attributes']['teamId'] == player_team), None)
    if team_summary:
        is_win = team_summary['metadata'].get('result') == 'victory'
        
    kast = stats.get('kast', {}).get('value')
    role_raw = player_summary['metadata'].get('roleName')
    role = resolve_role(curr_agent, role_override or role_raw)
    
    # Templates de Mensagem Principal (Fallbacks)
    POS_DEFAULT = [
        "Mandou {victim_agent} de arrasta com {weapon} aos {time}.",
        "Amassou no domínio de espaço com {weapon} contra {victim_agent}.",
        "Aula de mira com {weapon} pra cima de {victim_agent}.",
        "Segurou o rush inimigo aos {time} with {weapon}."
    ]
    
    FB_DEFAULT = "Abriu o round deitando {victim_agent} aos {time}."
    
    NEG_DEFAULT = [
        "Foi de base pra {killer_agent} ({weapon}) no contrapé aos {time}.",
        "Perdeu a troca direta contra {killer_agent} (Dano: {damage}).",
        "Pego dormindo (fora de posição) aos {time}.",
        "Tomou um sacode de {killer_agent} ({weapon}) aos {time}.",
        "Ficou isolado aos {time} e foi punido sem trade."
    ]

    rounds_analysis = []
    total_clutches = 0
    for r_num in range(1, curr_rounds + 1):
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
        current_kills = 0

        # Helper to find trades
        def check_trade(kill_index, target_id, is_killer):
            # Procura nos 5 segundos anteriores/posteriores (5000ms)
            current_kill = round_kills[kill_index]
            current_time = current_kill['metadata'].get('roundTime', 0)
            
            if is_killer:
                # Trade Positivo: Alguém do meu time morreu logo antes de eu matar o killer
                for i in range(kill_index - 1, -1, -1):
                    prev = round_kills[i]
                    if (current_time - prev['metadata'].get('roundTime', 0)) > 5000: break
                    # Se o cara que eu matei agora tinha acabado de matar um aliado meu
                    if prev['attributes'].get('platformUserIdentifier') == current_kill['attributes'].get('opponentPlatformUserIdentifier'):
                        return True
            else:
                # Trade Negativo: Eu morri e alguém do meu time matou meu killer logo depois
                for i in range(kill_index + 1, len(round_kills)):
                    next_k = round_kills[i]
                    if (next_k['metadata'].get('roundTime', 0) - current_time) > 5000: break
                    # Se meu killer morreu logo depois para um aliado meu
                    if next_k['attributes'].get('opponentPlatformUserIdentifier') == current_kill['attributes'].get('platformUserIdentifier'):
                        return True
            return False

        for idx, k in enumerate(round_kills):
            k_meta = k['metadata']
            k_attr = k['attributes']
            killer_id = k_attr['platformUserIdentifier']
            victim_id = k_attr['opponentPlatformUserIdentifier']
            
            rt_ms = k_meta.get('roundTime', 0)
            time_str = f"{rt_ms//60000}:{(rt_ms%60000)//1000:02d}"
            weapon = k_meta.get('weaponName', 'Unknown')
            damage = k.get('stats', {}).get('damage', {}).get('value', 0)

            # Posicoes e Radians para o mapa tatico
            victim_pos = k_meta.get('opponentLocation')
            player_locations = k_meta.get('playerLocations', [])
            
            killer_data = next((p for p in player_locations if p['platformUserIdentifier'] == killer_id), None)
            killer_pos = killer_data.get('location') if killer_data else None
            killer_radians = killer_data.get('viewRadians') if killer_data else None
            
            victim_data = next((p for p in player_locations if p['platformUserIdentifier'] == victim_id), None)
            victim_radians = victim_data.get('viewRadians') if victim_data else None

            event = {
                "killer_agent": player_agents.get(killer_id.upper(), 'Unknown'),
                "victim_agent": player_agents.get(victim_id.upper(), 'Unknown'),
                "weapon": weapon, "time": time_str, "time_ms": rt_ms,
                "is_player_killer": killer_id.upper() == player_target_upper,
                "is_player_victim": victim_id.upper() == player_target_upper,
                "killer_pos": killer_pos,
                "killer_radians": killer_radians,
                "victim_pos": victim_pos,
                "victim_radians": victim_radians
            }

            if event["is_player_killer"] or event["is_player_victim"]:
                tactical_events.append(event)
                ctx = {"victim_agent": event["victim_agent"], "killer_agent": event["killer_agent"], "weapon": weapon, "time": time_str, "damage": damage}
                
                is_first_kill_of_round = (event["time_ms"] == round_kills[0]['metadata'].get('roundTime', 0)) if round_kills else False

                if event["is_player_killer"]:
                    current_kills += 1
                    ctx['quantidade'] = current_kills
                    is_trade = check_trade(idx, player_target_upper, True)
                    
                    if is_first_kill_of_round:
                        pos_label = tm.format("first_blood", FB_DEFAULT, **ctx)
                        narrative_events.append({"time": time_str, "type": "pos", "text": f"FIRST BLOOD no {event['victim_agent']} ({weapon})", "ms": rt_ms})
                    elif is_trade:
                        pos_label = tm.format("trade_positivo", POS_DEFAULT, **ctx)
                        narrative_events.append({"time": time_str, "type": "pos", "text": f"TRADE no {event['victim_agent']} ({weapon})", "ms": rt_ms})
                    elif current_kills > 1:
                        pos_label = tm.format("multi_kill_positivo", POS_DEFAULT, **ctx)
                        narrative_events.append({"time": time_str, "type": "pos", "text": f"MULTI-KILL ({current_kills}x) no {event['victim_agent']}", "ms": rt_ms})
                    else:
                        pos_label = tm.format("pos_generic", POS_DEFAULT, **ctx)
                        narrative_events.append({"time": time_str, "type": "pos", "text": f"Garantiu o frag no {event['victim_agent']} ({weapon})", "ms": rt_ms})
                else:
                    is_trade_neg = check_trade(idx, player_target_upper, False)
                    if is_trade_neg:
                        neg_label = tm.format("trade_negativo", NEG_DEFAULT, **ctx)
                    else:
                        neg_label = tm.format("neg_generic", NEG_DEFAULT, **ctx)
                    narrative_events.append({"time": time_str, "type": "neg", "text": f"Foi de base para {event['killer_agent']} ({weapon})", "ms": rt_ms})

        r_sum = round_summaries.get(r_num)
        if r_sum:
            site = r_sum.get('plant', {}).get('site', 'Unknown') if r_sum.get('plant') else (r_sum.get('defuse', {}).get('site', 'Unknown') if r_sum.get('defuse') else 'Unknown')
            
            # Detecção de Round Type (Pistola, Eco, Force)
            is_win = r_sum.get('winningTeam') == player_team
            if is_win:
                if r_num in [1, 13]:
                    pos_label = pos_label or tm.format("round_pistola_positivo", "Ganhou o Pistola!")
                elif economy < 2500:
                    pos_label = pos_label or tm.format("round_eco_positivo", "Vitória no Round Eco!")
                elif 2500 <= economy <= 3800:
                    pos_label = pos_label or tm.format("round_force_positivo", "Vitória no Force Buy!")

            if r_sum.get('plant') and r_sum['plant']['platformUserIdentifier'].upper() == player_target_upper:
                pos_label = pos_label or tm.format("bomb_planted", "BOMB PLANTED", site=site)
                narrative_events.append({"time": "PLAN", "type": "pos", "text": f"Dominou o site {site} e garantiu o plant", "ms": r_sum['plant'].get('roundTime', 0)})
            if r_sum.get('defuse') and r_sum['defuse']['platformUserIdentifier'].upper() == player_target_upper:
                pos_label = pos_label or tm.format("bomb_defused", "CLUTCH DEFUSE", site=site)
                narrative_events.append({"time": "DEF", "type": "pos", "text": f"Clutch no defuse no site {site}! Garantiu o round no detalhe", "ms": r_sum['defuse'].get('roundTime', 0)})

        # Clutch Detection (v4.1.1)
        clutches = r_stats.get('clutches', {}).get('value', 0) if r_stats else 0
        if clutches > 0:
            total_clutches += int(clutches)
            pos_label = tm.format("clutch_positivo", pos_label or "CLUTCH!", quantidade=int(clutches))

        if economy < 2500 and kills_count > 0:
            pos_label = pos_label or tm.format("eco_kill", "ECOOU FORTE", economy=economy)
            narrative_events.insert(0, {"time": "ECO", "type": "pos", "text": f"Fez estrago no Round Eco (Gasto: ${economy})", "ms": -1})

        if deaths_count == 1 and kills_count == 0 and dmg < 50:
            neg_label = neg_label or tm.format("low_impact_death", "PINOU FEIO", damage=int(dmg))
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

    # --- Cálculo de Performance Ponderado (Role-Aware) ---
    # FONTE ÚNICA: Usa a mesma lógica em ambos Python e JS (eliminando dupla avaliação)
    perf_idx = calculate_performance_index_improved(actual_kd, target_kd, adr, role, kast, first_kills_count)
    
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
            holt_next[f"{m}_l"] = float(L_t)
            holt_next[f"{m}_t"] = float(T_t)
            holt_next[f"{m}_forecast"] = float(forecast)
        else:
            # Não inicializado aqui (o worker faz a média das 3 primeiras fora)
            # Usando strings para evitar problemas de tipo em alguns linters
            holt_next[f"{m}_l"] = None
            holt_next[f"{m}_t"] = None

    # --- DIRETRIZES TÁTICAS K.A.I.O. (Upgrade Trend-Aware) ---
    rt = ROLE_THRESHOLDS.get(role, ROLE_THRESHOLDS["Duelista"])
    conselhos = []

    # Check trends if available
    perf_t = holt_next.get("performance_t")
    if perf_t is not None:
        if perf_t > 0.5:
            conselhos.append(tm.format("insight_consistencia_alta", f"EVOLUÇÃO DETECTADA: Tendência de melhora robusta (+{perf_t:.1f}% por partida). O Oráculo prevê performance superior no próximo combate ({holt_next['performance_forecast']:.1f}%). Mantenha o ritmo."))
        elif perf_t < -0.5:
            conselhos.append(tm.format("insight_consistencia_baixa", f"ALERTA DE QUEDA: Tendência de performance negativa identificada ({perf_t:.1f}%). Seu nível técnico está oscilando para baixo. Reavalie sua postura tática antes da próxima partida."))
        
        kd_t = holt_next.get("kd_t")
        adr_t = holt_next.get("adr_t")
        if kd_t is not None and adr_t is not None:
            if kd_t > 0 and adr_t < 0:
                conselhos.append("DESBALANCEAMENTO TÁTICO: Seu K/D está subindo mas o ADR está caindo. Cuidado: você está garantindo abates sem gerar pressão real no mapa (Kills de baixo impacto/Exit frags).")
            elif kd_t < 0 and adr_t > 0:
                conselhos.append("INICIATIVA ALTA, BAIXA SOBREVIVÊNCIA: ADR em alta com K/D em queda. Você está causando muito dano mas morrendo sem garantir o frag. Melhore sua finalização e posicionamento pós-troca.")
            
    # --- INSIGHTS ESTRATÉGICOS (K.A.I.O. v2) ---
    best_agents = strat_context.get('bestAgents', [])
    if best_agents:
        top_agent = best_agents[0]
        # Se o agente atual for o melhor, ou se houver um agente muito melhor
        if top_agent['agent'] == curr_agent:
            if top_agent['avgPerf'] > 110:
                conselhos.append(f"DOMÍNIO DE PERSONAGEM: Você é oficialmente Main {curr_agent}. Sua performance média ({top_agent['avgPerf']:.1f}%) justifica a escolha.")
        elif top_agent['avgPerf'] > (perf_idx + 15):
             conselhos.append(f"OTIMIZAÇÃO DE AGENTE: Historicamente, sua performance com {top_agent['agent']} ({top_agent['avgPerf']:.1f}%) supera seu desempenho atual. Avalie a troca de função.")

    partners = strat_context.get('squadPartners', [])
    if partners:
        conselhos.append(f"SINERGIA OPERACIONAL: Squad detectado com {', '.join(partners)}. A coordenação de grupo é a chave para a vitória no Protocolo V.")

    # --- Artigos Constitucionais (Role-Aware) ---
    if adr < rt["adr_min"]:
        conselhos.append(rt["artigo_1_texto"])

    if first_kills_count >= rt["fb_excellence"]:
        conselhos.append(rt["artigo_2_texto"].format(fb=first_kills_count))
    elif rt.get("fb_min") and first_kills_count < rt["fb_min"]:
        conselhos.append(rt.get("artigo_fb_miss", "").format(fb=first_kills_count))

    kast_val = kast if kast is not None else 0
    if kast_val < rt["kast_min"] and rt.get("artigo_kast_miss"):
        conselhos.append(rt["artigo_kast_miss"].format(kast_min=rt["kast_min"]))

    if role == "Sentinela" and first_deaths_count >= 4 and rt.get("artigo_fd_warning"):
        conselhos.append(rt["artigo_fd_warning"].format(fd=first_deaths_count))
    
    if not conselhos:
        conselhos.append(tm.format("insight_recomendacao", "FOCO_OPERACIONAL: DESEMPENHO DENTRO DOS PARÂMETROS CONSTITUCIONAIS. O Oráculo segue monitorando sua evolução técnica."))

    # --- DERIVAÇÃO ÚNICA DE RANK E TOM (Fonte: performance_index) ---
    # Thresholds realistas para Silver-Diamond (não Radiant)
    # 100 = exatamente na meta do rank/agente/mapa
    # 115+ = 15% acima da meta
    # <80 = 20% abaixo da meta

    if perf_idx >= 115:
        perf_status = "ELITE DO PROTOCOLO"
        technical_rank = "Alpha"
        tone = f"O jogador brilhou como {curr_agent}. Use termos táticos para elogiar domínio do mapa e sinergia perfeita."
        conselhos.append("DESEMPENHO EXCEPCIONAL: Você está significativamente acima da média para seu elo. Mantenha este nível.")
    elif perf_idx >= 95:
        perf_status = "DENTRO DOS PARÂMETROS"
        technical_rank = "Omega"
        tone = f"Desempenho consistente e técnico. Aja como coach analítico — o jogador está no padrão esperado para seu nível."
    else:
        perf_status = "ABAIXO DO RADAR"
        technical_rank = "Depósito de Torreta"
        tone = f"O desempenho ficou aquém do esperado para {curr_agent} em {curr_map}. Seja direto sobre as deficiências táticas."
        conselhos.append(f"PERFORMANCE ABAIXO DA META: Você obteve {perf_idx:.1f}% da performance esperada. Revise seu posicionamento e timing.")

    # --- DETECÇÃO DE ESQUADRÃO (Sinergia) ---
    squad_stats = []
    for s in segments:
        if s['type'] == 'player-summary':
            s_team = s.get('metadata', {}).get('teamId', 'Unknown')
            if s_team == player_team:
                s_pid = s.get('attributes', {}).get('platformUserIdentifier', '') or \
                        s.get('metadata', {}).get('platformUserIdentifier', '')
                if s_pid and s_pid.replace(" ", "").upper() != player_target_clean:
                    squad_stats.append(s_pid)

    return {
        "player": target_player, "agent": agent_name, "role": role, "map": map_name, "map_details": map_details,
        "acs": acs, "adr": adr, "kd": actual_kd, "kast": kast, "performance_index": float(round(perf_idx, 1)),
        "impact_score": float(round(perf_idx, 1)), # [MIGRAÇÃO v4.2] Alinha com o IntelligenceLayer
        "performance_status": perf_status,
        "technical_rank": technical_rank,
        "squad_stats": squad_stats, # [SISTEMA DE SINERGIA] Habilita ranking de grupo
        "tone_instruction": tone,
        "kills": kills_total, "deaths": deaths_total, "clutches": total_clutches,
        "first_kills": first_kills_count,
        "first_deaths": first_deaths_count,
        "is_win": is_win,
        "result": "VITÓRIA" if is_win else "DERROTA", # [UI SYNC]
        "matches_analyzed": strat_context.get('matchesAnalyzed', 0),
        "holt": holt_next, "conselho_kaio": conselhos[0], "all_conselhos": conselhos,
        "total_rounds": curr_rounds, "rounds": rounds_analysis
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", required=True)
    parser.add_argument("--player", required=True)
    parser.add_argument("--target-kd", type=float, default=1.0)
    parser.add_argument("--agent")
    parser.add_argument("--role")
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
    parser.add_argument("--strat", help="Strategic Context JSON")
    parser.add_argument("--templates", help="Dynamic Templates JSON")
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

        strat_context = {}
        if args.strat:
            try:
                strat_context = json.loads(args.strat)
            except:
                pass

        result = analyze_match(content, args.player, args.target_kd, agent_name=args.agent, map_name=args.map, total_rounds=args.rounds, team_id=args.team, holt_prev=holt_prev, strat_context=strat_context, templates_json=args.templates, role_override=args.role)
        print(json.dumps(clean_nan(result), indent=2, ensure_ascii=False))
    except Exception as e:
        traceback.print_exc()
        print(json.dumps(clean_nan({"error": str(e)})))
