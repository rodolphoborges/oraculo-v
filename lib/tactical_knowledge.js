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

// --- AGENTES E FUNÇÕES (Official Roles) ---
export const AGENT_ROLES = {
    // DUELISTAS (Entry / Espaço)
    "Jett": "Duelista (Entry Frag / Espaço / Piloto)",
    "Raze": "Duelista (Entry Frag / Explosivos / Espaço)",
    "Phoenix": "Duelista (Entry Frag / Re-birth / Flash)",
    "Reyna": "Duelista (Entry Frag / Devorar / Sustento)",
    "Yoru": "Duelista (Entry Frag / Infiltração / Engano)",
    "Neon": "Duelista (Entry Frag / Velocidade / Choque)",
    "Iso": "Duelista (Entry Frag / Escudo / Duelo)",

    // SENTINELAS (Âncoras / Defesa)
    "Sage": "Sentinela (Suporte / Âncora / Cura - NUNCA deve ser Entry Frag)",
    "Cypher": "Sentinela (Informação / Travamento de Flanco / Setup)",
    "Killjoy": "Sentinela (Controle de Area / Post-plant / Turret Setup)",
    "Chamber": "Sentinela (Abates de Longa Distância / Eco-Economy)",
    "Deadlock": "Sentinela (Controle de Avanço / Interdição Sonora)",
    "Vyse": "Sentinela (Interdição / Antiflank / Arame Metálico)",
    "Veto": "Sentinela (Contenção / Senegal - Especialista em Defesa de Perímetro)",

    // INICIADORES (Info / Suporte / Flash)
    "Sova": "Iniciador (Reconhecimento / Drone / Dano de Longa Distância)",
    "Breach": "Iniciador (Controle de Grupo / Flash / Stun Através de Paredes)",
    "Skye": "Iniciador (Info / Flash / Cura / Lobinho)",
    "KAY/O": "Iniciador (Supressão / Flash / Faca de Info)",
    "Fade": "Iniciador (Revelação / Confinamento / Terror)",
    "Gekko": "Iniciador (Flash / Plant / Defuse / Info Reutilizável)",
    "Tejo": "Iniciador (Guia Balístico / Colômbia - Especialista em Utilitários de Precisão)",

    // CONTROLADORES (Visão / Controle)
    "Brimstone": "Controlador (Smokes / Beacon / Incendiário)",
    "Viper": "Controlador (Parede Tóxica / Veneno / Controle de Longa Duração)",
    "Omen": "Controlador (Smokes / Teleporte / Paranoia / Flash)",
    "Astra": "Controlador (Smokes / Gravidade / Stun Astral)",
    "Harbor": "Controlador (Muro de Água / Proteção / Visão)",
    "Clove": "Controlador (Smokes Pós-Morte / Agressividade Decadente)",
    "Miks": "Controlador (Sônico / Croácia - Especialista em Ruptura de Visão e Som)"
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
