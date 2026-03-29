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

// [NOVO] Dicionário Tático de Habilidades (Keywords) para o Prompt Flow
export const AGENT_KNOWLEDGE = {
  DUELIST: {
    Jett: ["Tailwind", "Cloudburst", "Updraft", "Blade Storm", "Dash", "Entry"],
    Raze: ["Paint Shells", "Blast Pack", "Showstopper", "Boom Bot", "Satchel"],
    Reyna: ["Dismiss", "Devour", "Leer", "Empress", "Overheal"],
    Phoenix: ["Curveball", "Hot Hands", "Blaze", "Run It Back"],
    Neon: ["High Gear", "Relay Bolt", "Fast Lane", "Overdrive"],
    Iso: ["Double Tap", "Undercut", "Contingency", "Kill Zone"],
  },
  INITIATOR: {
    Sova: ["Recon Bolt", "Shock Bolt", "Owl Drone", "Hunter's Fury", "Lineup"],
    Skye: ["Guiding Light", "Trailblazer", "Regrowth", "Seekers", "Flash"],
    Gekko: ["Dizzy", "Wingman", "Mosh Pit", "Thrash", "Plant/Defuse"],
    Fade: ["Haunt", "Seize", "Prowler", "Nightfall"],
    KAYO: ["ZERO/point", "FLASH/drive", "FRAG/ment", "NULL/cmd", "Suppress"],
  },
  CONTROLLER: {
    Omen: ["Dark Cover", "Shrouded Step", "Paranoia", "From the Shadows"],
    Brimstone: ["Sky Smoke", "Stim Beacon", "Incendiary", "Orbital Strike"],
    Viper: ["Toxic Screen", "Poison Cloud", "Snake Bite", "Viper’s Pit", "Lineup"],
    Clove: ["Ruse", "Meddle", "Pick-me-up", "Not Dead Yet"],
    Astra: ["Gravity Well", "Nova Pulse", "Nebula", "Cosmic Divide"],
  },
  SENTINEL: {
    Killjoy: ["Turret", "Alarmbot", "Nanoswarm", "Lockdown"],
    Cypher: ["Trapwire", "Cyber Cage", "Spycam", "Neural Theft"],
    Sage: ["Barrier Orb", "Slow Orb", "Healing Orb", "Resurrection", "Wall"],
    Chamber: ["Headhunter", "Rendezvous", "Trademark", "Tour de Force"],
    Deadlock: ["GravNet", "Sonic Sensor", "Barrier Mesh", "Annihilation"],
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
