/**
 * lib/tactical_knowledge.js
 * 
 * Fonte de Verdade Tática EXAUSTIVA para o Oráculo-V.
 * Dados extraídos oficialmente de playvalorant.com.
 * Inclui agentes da base global e novas entradas (Miks, Tejo, Veto).
 */

// --- MAPAS E SITES (Official Ground Truth) ---
export const MAP_SITES = {
    // 3 SITES
    "Haven": ["A", "B", "C"],
    "Lotus": ["A", "B", "C"],
    "Abyss": ["A", "B", "C"],
    // 2 SITES
    "Ascent": ["A", "B"],
    "Bind": ["A", "B"],
    "Breeze": ["A", "B"],
    "Fracture": ["A", "B"],
    "Icebox": ["A", "B"],
    "Pearl": ["A", "B"],
    "Split": ["A", "B"],
    "Sunset": ["A", "B"]
};

// --- CALLOUTS COMUNITÁRIOS BR (Terminologia Real) ---
export const MAP_CALLOUTS = {
    "Bind": "Bomb A (site A), Bomb B (site B), Short A (entrada curta da A / buraco), Long A (entrada longa da A), Short B (entrada curta da B / janela), Long B (entrada longa da B / hookah), Teleporter (tp), Lamps (lâmpadas)",
    "Haven": "Bomb A (site A), Bomb B (site B), Bomb C (site C), Long A, Short A, Garagem (garage B), Janela C, Long C",
    "Ascent": "Bomb A (site A), Bomb B (site B), Catwalk (passarela A), Short A (entrada do rato), Long A (entrada longa), Market (mercado B), Short B",
    "Split": "Bomb A (site A), Bomb B (site B), Mid (meio), Rampa A, Tela A (screen), Céu B (heaven B), Garagem B",
    "Icebox": "Bomb A (site A), Bomb B (site B), Long A (pipe), Short A (entrada curta), Tubo (tube), Kitchen B (cozinha B), Snowman",
    "Breeze": "Bomb A (site A), Bomb B (site B), Mid (meio), Tunel A, Long B (coluna B), Elbow B, Hall",
    "Fracture": "Bomb A (site A), Bomb B (site B), Dish A, Arcade B, Rope (zipline), Sandy, Tower",
    "Pearl": "Bomb A (site A), Bomb B (site B), Long A, Short A (art), Mid (meio), Secret, B Main, Long B",
    "Lotus": "Bomb A (site A), Bomb B (site B), Bomb C (site C), Long A, Short A, Porta Giratória (rotate door), Mound B, Waterfall C",
    "Sunset": "Bomb A (site A), Bomb B (site B), Mid (meio), Long A (entrada longa A), Short A (entrada curta A / rato), Market (mercado B), Boba B, Elbow",
    "Abyss": "Bomb A (site A), Bomb B (site B), Bomb C (site C), Long A, Short A, Bridge (ponte), Abismo"
};

// --- AGENTES E FUNÇÕES (Official Roles) ---
export const AGENT_ROLES = {
    // DUELISTAS
    "Jett": "Duelista [HABILIDADES: Erupção das Brumas (Smoke), Corrente de Ar (Impulso Vertical), Brisa de Impulso (Dash), Tormenta de Aço (Facas)]",
    "Raze": "Duelista [HABILIDADES: Bumba, Cartuchos de Tinta (Granada), Carga de Explosivos (Satchel), Estraga-Prazeres (Lança-Mísseis)]",
    "Phoenix": "Duelista [HABILIDADES: Labareda (Parede), Bola Curva (Flash), Mãos Quentes (Molotov), Renascimento (Ult)]",
    "Reyna": "Duelista [HABILIDADES: Olhar Voraz (Flash), Devorar (Cura), Dispensar (Fuga Invulnerável), Imperatriz (Ult)]",
    "Yoru": "Duelista [HABILIDADES: Falcatrua (Clone), Ponto Cego (Flash), Passagem Dimensional (Teleporte), Espionagem Dimensional (Ult)]",
    "Neon": "Duelista [HABILIDADES: Via Expresa (Corredor), Ricochete Elétrico (Stun), Equipamento Voltaico (Corrida), Sobrecarga (Ult Raios)]",
    "Iso": "Duelista [HABILIDADES: Contingência (Escudo Móvel), Debilitar (Vulnerável), Fluxo Constante (Escudo Pessoal), Contrato de Morte (Duelo Ult)]",
    "Waylay": "Duelista [HABILIDADES: Foco em Armadilha, Espaço e Infiltração Agressiva]",

    // SENTINELAS
    "Sage": "Sentinela [HABILIDADES: Orbe de Barreira (Parede), Orbe de Lentidão, Orbe Curativo, Ressurreição] -> NUNCA deve atuar como Entry Frag isolada.",
    "Cypher": "Sentinela [HABILIDADES: Fio-Armadilha (Trap), Jaula Cibernética (Smoke), Câmera de Vigilância, Assalto Neuronal (Ult Info)]",
    "Killjoy": "Sentinela [HABILIDADES: Robô de Alarme, Tureta, Enxame de Nanobôs (Granada), Confinamento (Ult de Área)]",
    "Chamber": "Sentinela [HABILIDADES: Marca Registrada (Trap), Caçador de Cabeças (Pistola), Rendezvous (Teleporte), Tour de Force (Sniper Ult)]",
    "Deadlock": "Sentinela [HABILIDADES: Rede de Gravidade (GravNet), Sensor Sônico, Malha de Barreira, Aniquilação (Ult Casulo)]",
    "Vyse": "Sentinela [HABILIDADES: Rosa Metálica (Flash), Arame Cifrado (Stun Fix), Muro Ceifador (Barreira Defensiva), Jardim de Aço (Ult Desarma)]",
    "Veto": "Sentinela [HABILIDADES: Defesa de Perímetro e Contenção de Área (Senegal)]",

    // INICIADORES
    "Sova": "Iniciador [HABILIDADES: Drone Coruja, Flecha de Choque, Flecha Rastreadora (Recon), Fúria do Caçador (Ult Dano)]",
    "Breach": "Iniciador [HABILIDADES: Pós-choque (Dano), Estopim (Flash), Falha Tectônica (Stun), Onda Trovejante (Ult Stun)]",
    "Skye": "Iniciador [HABILIDADES: Reflorescer (Cura), Predador Explosivo (Lobo), Luz Desbravadora (Passarinho Flash), Rastreadores (Ult Info)]",
    "KAY/O": "Iniciador [HABILIDADES: FRAG/mento (Granada), GRANADA/clarão (Flash), PONTO/zero (Faca Supressão), ANULAR/cmd (Ult Supressão)]",
    "Fade": "Iniciador [HABILIDADES: Espreitador (Cachorro/Prowler), Clausura (Seize), Assombrar (Olho/Recon), Véu da Noite (Ult Surdez/Nightfall)]",
    "Gekko": "Iniciador [HABILIDADES: Mosh Pit (Área Tóxica), Wingman (Planta Spike), Dizzy (Flash), Thrash (Ult Desarme/Cão)]",
    "Tejo": "Iniciador [HABILIDADES: Guia Balístico, Drones Mísseis Táticos - Especialista em Utilitários de Precisão]",

    // CONTROLADORES
    "Brimstone": "Controlador [HABILIDADES: Sinalizador Estimulante, Incendiário (Molotov), Fumaça Celeste (Smokes), Ataque Orbital (Ult Dano)]",
    "Viper": "Controlador [HABILIDADES: Veneno de Cobra, Nuvem Venenosa (Smoke), Cortina Tóxica (Parede), Poço Peçonhento (Ult)]",
    "Omen": "Controlador [HABILIDADES: Passos Tenebrosos (Teleporte), Paranoia (Cegueira), Manto Sombrio (Smokes), Salto das Sombras (Ult Global)]",
    "Astra": "Controlador [HABILIDADES: Poço Gravitacional, Pulso Nova (Concussão), Nebulosa (Smokes), Divisa Cósmica (Ult Parede Gigante)]",
    "Harbor": "Controlador [HABILIDADES: Cascata (Onda), Enseada (Escudo de Água), Maré Alta (Parede Flexível), Acerto de Contas (Ult Stun)]",
    "Clove": "Controlador [HABILIDADES: Revitalizar (Cura), Desvitalizar (Decay), Artimanha (Smokes - Ativas pós-morte), Ainda Não Morri (Ult Ressurreição)]",
    "Miks": "Controlador [HABILIDADES: Ondas Sônicas, Ruptura de Visão e Audição (Croácia)]"
};

// Dicionário Tático de Habilidades (Keywords) para o Prompt Flow
export const AGENT_KNOWLEDGE = {
  DUELIST: {
    Jett:    ["Tailwind (Dash)", "Cloudburst (Smoke)", "Updraft", "Blade Storm", "Entry Frag"],
    Raze:    ["Paint Shells", "Blast Pack (Satchel)", "Showstopper", "Boom Bot"],
    Reyna:   ["Dismiss (Fuga)", "Devour (Cura)", "Leer (Flash)", "Empress (Ult)"],
    Phoenix: ["Curveball (Flash)", "Hot Hands (Molotov)", "Blaze (Parede)", "Run It Back"],
    Neon:    ["High Gear (Corrida)", "Relay Bolt (Stun)", "Fast Lane (Corredor)", "Overdrive"],
    Iso:     ["Contingência (Escudo)", "Debilitar (Vulnerável)", "Fluxo Protetor", "Contrato de Abate"],
    Yoru:    ["Ponto Cego (Flash)", "Passagem Dimensional (TP)", "Distração (Clone)", "Espionagem Dimensional"],
    Waylay:  ["Ondas de Choque", "Infiltração Agressiva", "Foco de Armadilha", "Criação de Espaço"],
  },
  INITIATOR: {
    Sova:    ["Flecha Rastreadora (Recon)", "Flecha de Choque", "Drone Coruja", "Fúria do Caçador", "Lineup"],
    Skye:    ["Luz Desbravadora (Flash)", "Predador Explosivo (Lobo)", "Reflorescer (Cura)", "Rastreadores"],
    Gekko:   ["Dizzy (Flash)", "Wingman (Plant/Defuse)", "Mosh Pit", "Thrash"],
    Fade:    ["Assombrar (Recon)", "Clausura (Seize)", "Espreitador (Prowler)", "Véu da Noite"],
    Breach:  ["Estopim (Flash)", "Falha Tectônica (Stun)", "Pós-choque", "Onda Trovejante"],
    "KAY/O": ["PONTO/zero (Supressão)", "GRANADA/clarão (Flash)", "FRAG/mento", "ANULAR/cmd"],
    Tejo:    ["Rajada Guiada", "Entrega Especial", "Drone Furtivo", "Armagedom", "Precisão de Utilidade"],
  },
  CONTROLLER: {
    Omen:      ["Manto Sombrio (Smokes)", "Passos Tenebrosos (TP)", "Paranoia (Flash)", "Salto das Sombras"],
    Brimstone: ["Fumaça Celeste (Smokes)", "Incendiário (Molotov)", "Sinalizador Estimulante", "Ataque Orbital"],
    Viper:     ["Cortina Tóxica (Parede)", "Nuvem Venenosa (Smoke)", "Veneno de Cobra", "Poço Peçonhento", "Lineup"],
    Clove:     ["Artimanha (Smokes)", "Desvitalização", "Revitalizar (Cura)", "Ainda Não Morri"],
    Astra:     ["Nebulosa (Smokes)", "Poço Gravitacional", "Pulso Nova (Concussão)", "Divisa Cósmica"],
    Harbor:    ["Maré Alta (Parede)", "Enseada (Escudo)", "Temporal", "Acerto de Contas (Stun)"],
    Miks:      ["Harmonia (Ondas Sônicas)", "Ressonância", "Pulso M", "Melodia Sísmica", "Ruptura Auditiva"],
  },
  SENTINEL: {
    Killjoy:  ["Torreta", "Robô de Alarme", "Nanoenxame", "Confinamento (Lockdown)"],
    Cypher:   ["Fio-armadilha (Trap)", "Jaula Cibernética (Smoke)", "Câmera de Vigilância", "Assalto Neural"],
    Sage:     ["Orbe de Barreira (Parede)", "Orbe de Lentidão", "Orbe Curativo", "Ressurreição"],
    Chamber:  ["Caçador de Cabeças (Pistola)", "Rendezvous (TP)", "Marca Registrada (Trap)", "Tour de Force"],
    Deadlock: ["GravNet", "Sensor Sônico", "Barreira de Contenção", "Aniquilação (Casulo)"],
    Vyse:     ["Cerca-Viva (Stun)", "Rosa Arcana (Flash)", "Espinheiro Cortante", "Jardim de Aço (Desarma)"],
    Veto:     ["Imobilidade", "Interceptador", "Travessia", "Evolução (Ult)", "Defesa de Perímetro"],
  }
};

// --- ARSENAL (Official Weapon List) ---
export const ARSENAL = {
    "Sidearms": ["Classic", "Shorty", "Frenzy", "Ghost", "Sheriff"],
    "SMGs": ["Stinger", "Spectre"],
    "Shotguns": ["Bucky", "Judge"],
    "Rifles": ["Bulldog", "Guardian", "Phantom", "Vandal"],
    "Snipers": ["Marshal", "Outlaw", "Operator"],
    "MGs": ["Ares", "Odin"],
    "Melee": ["Faca Tática"]
};

/**
 * Retorna os sites válidos para um mapa (Case Insensitive).
 */
export function getValidSites(mapName) {
    if (!mapName) return ["A", "B"];
    const key = Object.keys(MAP_SITES).find(k => k.toLowerCase() === mapName.toLowerCase());
    return MAP_SITES[key] || ["A", "B"];
}

/**
 * Retorna a missão tática de um agente.
 */
export function getAgentMission(agentName) {
    if (!agentName) return "Combatente Valorant";
    const key = Object.keys(AGENT_ROLES).find(k => k.toLowerCase() === agentName.toLowerCase());
    return AGENT_ROLES[key] || "Combatente (Cumpra sua função base)";
}

/**
 * Retorna o Arsenal Completo para o Coach.
 */
export function getFullArsenal() {
    return Object.entries(ARSENAL)
        .map(([cat, weapons]) => `${cat}: ${weapons.join(', ')}`)
        .join(' | ');
}

/**
 * Retorna os callouts BR de um mapa específico.
 */
export function getMapCallouts(mapName) {
    if (!mapName) return "Use Bomb A e Bomb B como referência.";
    const key = Object.keys(MAP_CALLOUTS).find(k => k.toLowerCase() === mapName.toLowerCase());
    return MAP_CALLOUTS[key] || "Use Bomb A e Bomb B como referência.";
}

// --- OBRIGAÇÕES TÁTICAS POR FUNÇÃO (Role Context para LLM) ---
// Injetado no prompt para que o coach avalie o jogador segundo critérios do SEU PAPEL,
// não de um padrão genérico de fragger.
export const ROLE_OBLIGATIONS = {
    "Duelista": {
        primary_metric: "First Bloods (FB) e ADR",
        secondary_metrics: "ACS e K/D",
        obligations: [
            "Abrir rounds com First Blood para criar vantagem numérica IMEDIATA",
            "Entrar no site PRIMEIRO e criar espaço para o time",
            "Manter ADR alto como reflexo de pressão constante no mapa",
            "Duelar 1v1 e garantir o frag sem depender de trade"
        ],
        success_indicators: "ADR ≥140, ≥2 First Bloods por partida, K/D positivo",
        failure_indicators: "ADR <100, 0 First Bloods, entrar no site como último da fila",
        coach_must_check: "Timing de peek, posicionamento pré-duelo e decisão de entry",
        do_not_penalize: "KAST moderado — Duelista abre rounds e pode morrer no processo"
    },
    "Iniciador": {
        primary_metric: "KAST e ACS",
        secondary_metrics: "Assistências e utilidade ativa",
        obligations: [
            "Limpar ângulos com utilitário (flashes, recon) ANTES da equipe entrar",
            "Manter KAST alto sendo ativo em trades, assists e survivals",
            "Abrir informação sobre posicionamento inimigo para o time",
            "Sincronizar utilidade com a entrada do Duelista no site"
        ],
        success_indicators: "KAST ≥72%, assistências consistentes, recon ativo antes de entradas",
        failure_indicators: "KAST <60%, utilitário desperdiçado ou mal sincronizado com o time",
        coach_must_check: "Coordenação de utilidade com o time, timing de recon e flashes pré-entry",
        do_not_penalize: "ADR moderado e poucos FBs — Iniciador é o facilitador, não o fragger principal"
    },
    "Controlador": {
        primary_metric: "KAST e Clutches",
        secondary_metrics: "Round Win % com utilidade ativa",
        obligations: [
            "Dominar visão do mapa com smokes estratégicas em ângulos críticos",
            "Negar retake inimigo no pós-plant com utilidade de área",
            "Manter KAST alto sendo essencial para o time sobreviver na fase defensiva",
            "Clutchar rounds em situações 1vX mantendo calma tática"
        ],
        success_indicators: "KAST ≥75%, smokes bem posicionadas, presente e vivo no pós-plant",
        failure_indicators: "KAST <65%, smokes desperdiçadas, morte precoce sem gerar valor",
        coach_must_check: "Posicionamento de smokes, gestão de fuel/munição de utilidade e clutch sense",
        do_not_penalize: "ADR baixo e poucos First Bloods — Controlador NÃO é fragger, é o arquiteto da rodada"
    },
    "Sentinela": {
        primary_metric: "KAST e informação defensiva",
        secondary_metrics: "Clutches e sobrevivência",
        obligations: [
            "Proteger o flanco do time com armadilhas, câmeras e barreiras ativas",
            "Manter KAST alto sendo o âncora defensiva e informacional do round",
            "NUNCA agir como Entry Frag isolado — risco desnecessário viola a função",
            "Transmitir informação sobre movimentos inimigos via câmeras e sensores ativos"
        ],
        success_indicators: "KAST ≥70%, flanco protegido, First Deaths evitadas em posição agressiva",
        failure_indicators: "KAST <60%, First Deaths repetidas em posição agressiva, flanco exposto",
        coach_must_check: "Posicionamento defensivo, uso de utilidade informacional e trades seguros",
        do_not_penalize: "ADR baixo e 0 First Bloods são ESPERADOS de Sentinela — cobrar isso é erro de análise"
    }
};

/**
 * Retorna as obrigações táticas de um role para injeção no prompt LLM.
 * @param {string} role - "Duelista" | "Iniciador" | "Controlador" | "Sentinela"
 * @returns {object|null}
 */
export function getRoleObligations(role) {
    if (!role) return null;
    const key = Object.keys(ROLE_OBLIGATIONS).find(k =>
        k.toLowerCase() === role.toLowerCase()
    );
    return ROLE_OBLIGATIONS[key] || null;
}
