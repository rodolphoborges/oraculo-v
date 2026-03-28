/**
 * lib/tactical_knowledge.js
 * 
 * Fonte da Verdade Tática para o Oráculo-V.
 * Mapeia Mapas e Agentes para evitar alucinações da LLM.
 */

export const MAP_SITES = {
    "Astra": ["A", "B"], // Astra is an agent, but let's be safe if someone confuses map names
    "Ascent": ["A", "B"],
    "Bind": ["A", "B"],
    "Breeze": ["A", "B"],
    "Fracture": ["A", "B"],
    "Haven": ["A", "B", "C"],
    "Icebox": ["A", "B"],
    "Lotus": ["A", "B", "C"],
    "Pearl": ["A", "B"],
    "Split": ["A", "B"],
    "Sunset": ["A", "B"],
    "Abyss": ["A", "B", "C"]
};

export const AGENT_ROLES = {
    // DUELISTAS (Entry Fraggers)
    "Jett": "Duelista (Entry Frag / Espaço)",
    "Raze": "Duelista (Entry Frag / Espaço)",
    "Phoenix": "Duelista (Entry Frag / Flash)",
    "Reyna": "Duelista (Entry Frag / Sustento)",
    "Yoru": "Duelista (Entry Frag / Infiltração)",
    "Neon": "Duelista (Entry Frag / Velocidade)",
    "Iso": "Duelista (Entry Frag / Escudo)",

    // SENTINELAS (Âncoras / Defesa)
    "Sage": "Sentinela (Suporte / Âncora - NUNCA deve ser Entry Frag)",
    "Cypher": "Sentinela (Informação / Travamento de Site)",
    "Killjoy": "Sentinela (Controle de Area / Setup)",
    "Chamber": "Sentinela (Eco-Economy / Abates de Longa Distância)",
    "Deadlock": "Sentinela (Controle de Avanço / Antiflank)",
    "Vyse": "Sentinela (Interdição / Antiflank)",

    // INICIADORES (Suporte / Info)
    "Sova": "Iniciador (Reconhecimento / Drone)",
    "Breach": "Iniciador (Stun / Utilitário Através de Parede)",
    "Skye": "Iniciador (Flash / Cura / Info)",
    "KAY/O": "Iniciador (Supressão / Flash)",
    "Fade": "Iniciador (Revelação / Terror)",
    "Gekko": "Iniciador (Flash / Plant / Info)",

    // CONTROLADORES (Smokes / Visão)
    "Brimstone": "Controlador (Smokes / Beacon / Molotov)",
    "Viper": "Controlador (Parede Tóxica / Decaimento)",
    "Omen": "Controlador (Smokes / Teleporte / Flash)",
    "Astra": "Controlador (Smokes / Gravity Well / Stun)",
    "Harbor": "Controlador (Muro de Água / Proteção)",
    "Clove": "Controlador (Smokes Pós-Morte / Agressividade Decadente)"
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
