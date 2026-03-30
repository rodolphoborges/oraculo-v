/**
 * lib/tactical_knowledge.js
 * 
 * Hyper-efficient, LLM-ready tactical engine for Valorant analytics.
 * Version: 2.0.0
 */

export const KNOWLEDGE_VERSION = "2.0.0";

// --- CORE UTILS ---

/**
 * Normalizes strings for case-insensitive and safe lookup.
 */
export function normalize(str) {
    if (!str || typeof str !== 'string') return "";
    return str.toLowerCase()
        .trim()
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""); // Remove accents
}

// --- TACTICAL CONSTANTS ---

export const TACTICAL_TAGS = {
    ENTRY: "entry",
    TRADE: "trade",
    CLUTCH: "clutch",
    ANCHOR: "anchor",
    LURKER: "lurker",
    RETAKE: "retake",
    POST_PLANT: "post-plant",
    ECO: "eco",
    ANTI_ECO: "anti-eco",
    RECON: "recon",
    UTILITY: "utility",
    SUPPORT: "support"
};

export const ROLES = {
    DUELISTA: "duelista",
    INICIADOR: "iniciador",
    CONTROLADOR: "controlador",
    SENTINELA: "sentinela"
};

// --- AGENTS REGISTRY (Unified & Structured) ---

export const AGENTS = {
    jett: {
        name: "Jett",
        role: ROLES.DUELISTA,
        abilities: {
            mobility: ["Tailwind (Dash)", "Updraft"],
            utility: ["Cloudburst (Smoke)"],
            damage: ["Blade Storm (Ult)"],
            ultimate: "Blade Storm"
        },
        tags: [TACTICAL_TAGS.ENTRY, TACTICAL_TAGS.TRADE],
        source: "official"
    },
    raze: {
        name: "Raze",
        role: ROLES.DUELISTA,
        abilities: {
            mobility: ["Blast Pack (Satchel)"],
            utility: ["Boom Bot"],
            damage: ["Paint Shells (Granada)", "Showstopper (Ult)"],
            ultimate: "Showstopper"
        },
        tags: [TACTICAL_TAGS.ENTRY, TACTICAL_TAGS.TRADE],
        source: "official"
    },
    phoenix: {
        name: "Phoenix",
        role: ROLES.DUELISTA,
        abilities: {
            mobility: [],
            utility: ["Curveball (Flash)", "Blaze (Parede)", "Hot Hands (Molotov)"],
            damage: ["Hot Hands", "Run It Back (Ult)"],
            ultimate: "Run It Back"
        },
        tags: [TACTICAL_TAGS.ENTRY, TACTICAL_TAGS.RETAKE],
        source: "official"
    },
    reyna: {
        name: "Reyna",
        role: ROLES.DUELISTA,
        abilities: {
            mobility: ["Dismiss (Fuga)"],
            utility: ["Leer (Flash)", "Devour (Cura)"],
            damage: ["Empress (Ult)"],
            ultimate: "Empress"
        },
        tags: [TACTICAL_TAGS.ENTRY, TACTICAL_TAGS.CLUTCH],
        source: "official"
    },
    yoru: {
        name: "Yoru",
        role: ROLES.DUELISTA,
        abilities: {
            mobility: ["Gatecrash (TP)"],
            utility: ["Blindside (Flash)", "Fakeout (Clone)"],
            damage: ["Dimensional Drift (Ult)"],
            ultimate: "Dimensional Drift"
        },
        tags: [TACTICAL_TAGS.LURKER, TACTICAL_TAGS.RETAKE],
        source: "official"
    },
    neon: {
        name: "Neon",
        role: ROLES.DUELISTA,
        abilities: {
            mobility: ["High Gear (Corrida)"],
            utility: ["Relay Bolt (Stun)", "Fast Lane (Parede)"],
            damage: ["Overdrive (Ult)"],
            ultimate: "Overdrive"
        },
        tags: [TACTICAL_TAGS.ENTRY, TACTICAL_TAGS.RETAKE],
        source: "official"
    },
    iso: {
        name: "Iso",
        role: ROLES.DUELISTA,
        abilities: {
            mobility: [],
            utility: ["Contingency (Escudo)", "Undercut (Vulnerável)", "Double Tap"],
            damage: ["Kill Contract (Ult)"],
            ultimate: "Kill Contract"
        },
        tags: [TACTICAL_TAGS.ENTRY, TACTICAL_TAGS.TRADE],
        source: "official"
    },
    waylay: {
        name: "Waylay",
        role: ROLES.DUELISTA,
        abilities: {
            mobility: ["Infiltração Agressiva"],
            utility: ["Foco em Armadilha", "Espaço"],
            damage: ["Ondas de Choque"],
            ultimate: "Desconhecida"
        },
        tags: [TACTICAL_TAGS.ENTRY, TACTICAL_TAGS.LURKER],
        source: "custom"
    },
    sage: {
        name: "Sage",
        role: ROLES.SENTINELA,
        abilities: {
            mobility: [],
            utility: ["Barrier Orb (Parede)", "Slow Orb", "Healing Orb"],
            damage: ["Resurrection (Ult)"],
            ultimate: "Resurrection"
        },
        tags: [TACTICAL_TAGS.ANCHOR, TACTICAL_TAGS.SUPPORT],
        source: "official"
    },
    cypher: {
        name: "Cypher",
        role: ROLES.SENTINELA,
        abilities: {
            mobility: [],
            utility: ["Trapwire (Fio)", "Cyber Cage (Smoke)", "Spycam"],
            damage: ["Neural Theft (Ult)"],
            ultimate: "Neural Theft"
        },
        tags: [TACTICAL_TAGS.ANCHOR, TACTICAL_TAGS.RECON, TACTICAL_TAGS.LURKER],
        source: "official"
    },
    killjoy: {
        name: "Killjoy",
        role: ROLES.SENTINELA,
        abilities: {
            mobility: [],
            utility: ["Alarmbot", "Turret"],
            damage: ["Nanoswarm (Granada)", "Lockdown (Ult)"],
            ultimate: "Lockdown"
        },
        tags: [TACTICAL_TAGS.ANCHOR, TACTICAL_TAGS.POST_PLANT],
        source: "official"
    },
    chamber: {
        name: "Chamber",
        role: ROLES.SENTINELA,
        abilities: {
            mobility: ["Rendezvous (TP)"],
            utility: ["Trademark (Trap)"],
            damage: ["Headhunter (Pistola)", "Tour de Force (Ult)"],
            ultimate: "Tour de Force"
        },
        tags: [TACTICAL_TAGS.ANCHOR, TACTICAL_TAGS.ECO],
        source: "official"
    },
    deadlock: {
        name: "Deadlock",
        role: ROLES.SENTINELA,
        abilities: {
            mobility: [],
            utility: ["Sonic Sensor", "Barrier Mesh", "GravNet"],
            damage: ["Annihilation (Ult)"],
            ultimate: "Annihilation"
        },
        tags: [TACTICAL_TAGS.ANCHOR, TACTICAL_TAGS.RETAKE],
        source: "official"
    },
    vyse: {
        name: "Vyse",
        role: ROLES.SENTINELA,
        abilities: {
            mobility: [],
            utility: ["Arc Rose (Flash)", "Shear (Parede)", "Razorvine (Stun)"],
            damage: ["Steel Garden (Ult)"],
            ultimate: "Steel Garden"
        },
        tags: [TACTICAL_TAGS.ANCHOR, TACTICAL_TAGS.ANTI_ECO],
        source: "official"
    },
    veto: {
        name: "Veto",
        role: ROLES.SENTINELA,
        abilities: {
            mobility: ["Travessia"],
            utility: ["Imobilidade", "Interceptador", "Defesa de Perímetro"],
            damage: ["Evolução (Ult)"],
            ultimate: "Evolução"
        },
        tags: [TACTICAL_TAGS.ANCHOR, TACTICAL_TAGS.UTILITY],
        source: "custom"
    },
    sova: {
        name: "Sova",
        role: ROLES.INICIADOR,
        abilities: {
            mobility: [],
            utility: ["Recon Bolt", "Owl Drone"],
            damage: ["Shock Bolt", "Hunter's Fury (Ult)"],
            ultimate: "Hunter's Fury"
        },
        tags: [TACTICAL_TAGS.RECON, TACTICAL_TAGS.POST_PLANT],
        source: "official"
    },
    breach: {
        name: "Breach",
        role: ROLES.INICIADOR,
        abilities: {
            mobility: [],
            utility: ["Flashpoint", "Fault Line (Stun)"],
            damage: ["Aftershock", "Rolling Thunder (Ult)"],
            ultimate: "Rolling Thunder"
        },
        tags: [TACTICAL_TAGS.ENTRY, TACTICAL_TAGS.RETAKE],
        source: "official"
    },
    skye: {
        name: "Skye",
        role: ROLES.INICIADOR,
        abilities: {
            mobility: [],
            utility: ["Guiding Light (Flash)", "Regrowth (Cura)", "Trailblazer (Lobo)"],
            damage: ["Seekers (Ult)"],
            ultimate: "Seekers"
        },
        tags: [TACTICAL_TAGS.RECON, TACTICAL_TAGS.TRADE],
        source: "official"
    },
    kayo: {
        name: "KAY/O",
        role: ROLES.INICIADOR,
        abilities: {
            mobility: [],
            utility: ["ZERO/point (Faca)", "FLASH/drive"],
            damage: ["FRAG/ment (Granada)", "NULL/cmd (Ult)"],
            ultimate: "NULL/cmd"
        },
        tags: [TACTICAL_TAGS.ENTRY, TACTICAL_TAGS.ANTI_ECO],
        source: "official"
    },
    fade: {
        name: "Fade",
        role: ROLES.INICIADOR,
        abilities: {
            mobility: [],
            utility: ["Haunt (Olho)", "Seize (Clausura)", "Prowler (Espreitador)"],
            damage: ["Nightfall (Ult)"],
            ultimate: "Nightfall"
        },
        tags: [TACTICAL_TAGS.RECON, TACTICAL_TAGS.RETAKE],
        source: "official"
    },
    gekko: {
        name: "Gekko",
        role: ROLES.INICIADOR,
        abilities: {
            mobility: [],
            utility: ["Dizzy (Flash)", "Wingman (Plant/Defuse)"],
            damage: ["Mosh Pit", "Thrash (Ult)"],
            ultimate: "Thrash"
        },
        tags: [TACTICAL_TAGS.SUPPORT, TACTICAL_TAGS.UTILITY],
        source: "official"
    },
    tejo: {
        name: "Tejo",
        role: ROLES.INICIADOR,
        abilities: {
            mobility: [],
            utility: ["Guia Balístico", "Drone Furtivo", "Entrega Especial"],
            damage: ["Armagedom (Ult)"],
            ultimate: "Armagedom"
        },
        tags: [TACTICAL_TAGS.UTILITY, TACTICAL_TAGS.RECON],
        source: "custom"
    },
    brimstone: {
        name: "Brimstone",
        role: ROLES.CONTROLADOR,
        abilities: {
            mobility: [],
            utility: ["Sky Smoke", "Stim Beacon"],
            damage: ["Incendiary", "Orbital Strike (Ult)"],
            ultimate: "Orbital Strike"
        },
        tags: [TACTICAL_TAGS.ANCHOR, TACTICAL_TAGS.POST_PLANT],
        source: "official"
    },
    viper: {
        name: "Viper",
        role: ROLES.CONTROLADOR,
        abilities: {
            mobility: [],
            utility: ["Toxic Screen (Parede)", "Poison Cloud (Smoke)"],
            damage: ["Snake Bite (Molly)", "Viper's Pit (Ult)"],
            ultimate: "Viper's Pit"
        },
        tags: [TACTICAL_TAGS.ANCHOR, TACTICAL_TAGS.POST_PLANT, TACTICAL_TAGS.LURKER],
        source: "official"
    },
    omen: {
        name: "Omen",
        role: ROLES.CONTROLADOR,
        abilities: {
            mobility: ["Shrouded Step (TP)"],
            utility: ["Dark Cover (Smoke)", "Paranoia (Blind)"],
            damage: ["From the Shadows (Ult)"],
            ultimate: "From the Shadows"
        },
        tags: [TACTICAL_TAGS.LURKER, TACTICAL_TAGS.RETAKE, TACTICAL_TAGS.CLUTCH],
        source: "official"
    },
    astra: {
        name: "Astra",
        role: ROLES.CONTROLADOR,
        abilities: {
            mobility: [],
            utility: ["Gravity Well", "Nova Pulse", "Nebula (Smoke)"],
            damage: ["Cosmic Divide (Ult)"],
            ultimate: "Cosmic Divide"
        },
        tags: [TACTICAL_TAGS.ANCHOR, TACTICAL_TAGS.RECON],
        source: "official"
    },
    harbor: {
        name: "Harbor",
        role: ROLES.CONTROLADOR,
        abilities: {
            mobility: [],
            utility: ["High Tide (Parede)", "Cove (Escudo)", "Cascade"],
            damage: ["Reckoning (Ult)"],
            ultimate: "Reckoning"
        },
        tags: [TACTICAL_TAGS.ENTRY, TACTICAL_TAGS.SUPPORT],
        source: "official"
    },
    clove: {
        name: "Clove",
        role: ROLES.CONTROLADOR,
        abilities: {
            mobility: [],
            utility: ["Ruse (Smokes)", "Meddle (Decay)", "Pick-Me-Up"],
            damage: ["Not Dead Yet (Ult)"],
            ultimate: "Not Dead Yet"
        },
        tags: [TACTICAL_TAGS.TRADE, TACTICAL_TAGS.CLUTCH],
        source: "official"
    },
    miks: {
        name: "Miks",
        role: ROLES.CONTROLADOR,
        abilities: {
            mobility: [],
            utility: ["Ondas Sônicas", "Ressonância", "Ruptura Auditiva"],
            damage: ["Melodia Sísmica (Ult)"],
            ultimate: "Melodia Sísmica"
        },
        tags: [TACTICAL_TAGS.SUPPORT, TACTICAL_TAGS.UTILITY],
        source: "custom"
    }
};

// --- SYNERGY & COMPOSITION ---

export const AGENT_SYNERGY = {
    breach: {
        strong_with: ["jett", "raze", "neon"],
        reason: "Flash e Stun permitem que duelistas agressivos entrem com segurança e garantam kills de vantagem."
    },
    sova: {
        strong_with: ["jett", "kayo"],
        reason: "Informação de recon aliada a mobilidade ou supressão maximiza o potencial de entry."
    },
    viper: {
        strong_with: ["killjoy", "brimstone"],
        reason: "Combinação de setups defensivos e pós-plant extremamente difíceis de desativar."
    },
    fade: {
        strong_with: ["raze"],
        reason: "A 'Seize' segura inimigos enquanto a granada ou o ult da Raze garante o dano massivo."
    },
    gekko: {
        strong_with: ["clove", "omen"],
        reason: "Smokes garantem cobertura enquanto o Wingman planta ou defusa a Spike."
    }
};

// --- MAP KNOWLEDGE ---

export const MAP_SITES = {
    haven: ["A", "B", "C"],
    lotus: ["A", "B", "C"],
    abyss: ["A", "B", "C"],
    ascent: ["A", "B"],
    bind: ["A", "B"],
    breeze: ["A", "B"],
    fracture: ["A", "B"],
    icebox: ["A", "B"],
    pearl: ["A", "B"],
    split: ["A", "B"],
    sunset: ["A", "B"]
};

export const MAP_CALLOUTS = {
    bind: ["Bomb A", "Bomb B", "Short A", "Long A", "Short B", "Long B (Hookah)", "TP", "Lamps"],
    haven: ["Bomb A", "Bomb B", "Bomb C", "Long A", "Short A", "Garage", "Window C", "Long C"],
    ascent: ["Bomb A", "Bomb B", "Catwalk", "Short A (Rato)", "Long A", "Market", "Short B"],
    split: ["Bomb A", "Bomb B", "Mid", "Rampa A", "Screen", "Heaven B", "Garage B"],
    icebox: ["Bomb A", "Bomb B", "Pipe", "Tubo", "Kitchen", "Snowman", "Yellow B"],
    sunset: ["Bomb A", "Bomb B", "Mid", "Main A", "Short A", "Market", "Boba", "Elbow"],
    abyss: ["Bomb A", "Bomb B", "Bomb C", "Bridge", "Abismo", "Secret", "Mid"],
    lotus: ["Bomb A", "Bomb B", "Bomb C", "Rotate Door", "Mound", "Waterfall", "Tree"]
};

export const MAP_META = {
    ascent: {
        strong_agents: ["sova", "killjoy", "omen", "jett", "kayo"],
        weak_agents: ["raze", "harbor"],
        style: "Default/Execuções precisas através do Mid."
    },
    bind: {
        strong_agents: ["brimstone", "raze", "viper", "skye", "cypher"],
        weak_agents: ["sova"],
        style: "Execuções agressivas e rotações rápidas via TP."
    },
    haven: {
        strong_agents: ["jett", "sova", "killjoy", "breach", "omen"],
        style: "Controle de 3 sites exigindo rotações complexas."
    },
    icebox: {
        strong_agents: ["jett", "viper", "killjoy", "sova", "sage"],
        style: "Verticalidade e controle de visão em longas distâncias."
    },
    split: {
        strong_agents: ["raze", "sage", "omen", "cypher", "skye"],
        style: "Disputa intensa pelo controle do Meio e Céu."
    }
};

// --- ROUND CONTEXT INTELLIGENCE ---

export const ROUND_CONTEXT = {
    eco: { 
        strategy: "Jogar em bando, buscar picks isolados para roubar armas e stackar sites.",
        risk: "Alta vulnerabilidade em duelos de longa distância."
    },
    anti_eco: {
        strategy: "Manter distância, usar utilitários para limpar ângulos sem dar a cara e evitar morrer com arma boa.",
        risk: "Perca de vantagem econômica se for pego em rush."
    },
    post_plant: {
        strategy: "Jogar o tempo, negar o defuse com molly/utilidade e manter crossfire.",
        priority: "Sobrevivência sobre kills."
    },
    retake: {
        strategy: "Sincronizar utilitários de entrada, limpar o site sistematicamente e garantir o defuse.",
        priority: "Coordenação de flashes e fumaças."
    }
};

// --- PERFORMANCE SYSTEM ---

export const PERFORMANCE_WEIGHTS = {
    duelista: { adr: 0.4, fb: 0.3, kd: 0.2, kast: 0.1 },
    iniciador: { adr: 0.2, kast: 0.4, assists: 0.3, combat_score: 0.1 },
    controlador: { kast: 0.5, clutches: 0.3, round_wins_util: 0.2 },
    sentinela: { kast: 0.4, survival: 0.3, defensive_info: 0.3 }
};

/**
 * Calculates a role-specific performance score (0-100).
 */
export function calculatePerformanceScore(stats, role) {
    if (!stats || !role) return 0;
    const normalizedRole = normalize(role);
    const weights = PERFORMANCE_WEIGHTS[normalizedRole] || { adr: 0.25, kd: 0.25, kast: 0.25, combat_score: 0.25 };
    
    let score = 0;
    Object.keys(weights).forEach(key => {
        const val = stats[key] || 0;
        score += val * weights[key];
    });
    
    return Math.min(Math.round(score), 100);
}

// --- BEHAVIOR & OBLIGATIONS ---

export const ROLE_PHASE_BEHAVIOR = {
    duelista: {
        early: "Abrir o mapa e buscar pick de vantagem.",
        mid: "Entrar no site e criar espaço.",
        late: "Finalizar oponentes restantes em clutch situations."
    },
    sentinela: {
        early: "Setup defensivo e proteção de flancos.",
        mid: "Monitoramento de informação passiva.",
        late: "Ancorar o site ou garantir o pós-plant com traps."
    },
    iniciador: {
        early: "Recon de presença inimiga.",
        mid: "Facilitar a entrada com flashes e stuns.",
        late: "Utilizar recon para localizar oponentes em retake."
    },
    controlador: {
        early: "Smokes defensivas e controle de visão global.",
        mid: "Bloquear reforços inimigos durante execuções.",
        late: "Negar visão no pós-plant ou retake."
    }
};

export const ROLE_OBLIGATIONS = {
    duelista: {
        primary_metric: "First Bloods (FB) e ADR",
        obligations: [
            "Abrir rounds com First Blood",
            "Entrar no site PRIMEIRO",
            "Manter ADR alto",
            "Garantir kills de entrada (entry fragger)"
        ],
        success_indicators: "ADR ≥140, ≥2 FB/partida, K/D positivo",
        failure_indicators: "ADR <100, 0 FB, entrar por último"
    },
    iniciador: {
        primary_metric: "KAST e Assistências",
        obligations: [
            "Limpar ângulos com utilitário ANTES da entrada",
            "Manter KAST alto em trades",
            "Abrir informação sobre oponentes",
            "Sincronizar utilidade com duelistas"
        ],
        success_indicators: "KAST ≥72%, assistências consistentes",
        failure_indicators: "KAST <60%, surdez tática no recon"
    },
    controlador: {
        primary_metric: "KAST e Clutches",
        obligations: [
            "Domínio de visão com smokes estratégicas",
            "Negar retake no pós-plant",
            "Sobreviver para garantir smokes defensivas",
            "Clutchar rounds mantendo calma tática"
        ],
        success_indicators: "KAST ≥75%, smokes bem posicionadas",
        failure_indicators: "KAST <65%, morte precoce constante"
    },
    sentinela: {
        primary_metric: "KAST e Info Defensiva",
        obligations: [
            "Proteger o flanco com armadilhas",
            "Âncora informacional do round",
            "NUNCA ser o entry frag isolado",
            "Monitorar rotações via sensores"
        ],
        success_indicators: "KAST ≥70%, flanco protegido, FDs evitadas",
        failure_indicators: "KAST <60%, flanco exposto"
    }
};

// --- LEGACY ARSENAL ---

export const ARSENAL = {
    sidearms: ["Classic", "Shorty", "Frenzy", "Ghost", "Sheriff"],
    smgs: ["Stinger", "Spectre"],
    shotguns: ["Bucky", "Judge"],
    rifles: ["Bulldog", "Guardian", "Phantom", "Vandal"],
    snipers: ["Marshal", "Outlaw", "Operator"],
    mgs: ["Ares", "Odin"],
    melee: ["Faca Tática"]
};

// --- ENGINE LOGIC & HELPERS ---

/**
 * Returns structured agent data (Case-Insensitive).
 */
export function getAgent(name) {
    if (!name) return null;
    const normalized = normalize(name);
    return AGENTS[normalized] || null;
}

/**
 * Returns valid sites for a map (Case-Insensitive).
 */
export function getValidSites(mapName) {
    if (!mapName) return ["A", "B"];
    const normalized = normalize(mapName);
    return MAP_SITES[normalized] || ["A", "B"];
}

/**
 * Returns the tactical mission summary of an agent.
 */
export function getAgentMission(agentName) {
    const agent = getAgent(agentName);
    if (!agent) return "Combatente Valorant (Cumpra sua função base)";
    return `${agent.name} - ${agent.role.toUpperCase()} [Tags: ${agent.tags.join(', ')}]`;
}

/**
 * Returns Brazilian callouts for a specific map.
 */
export function getMapCallouts(mapName) {
    if (!mapName) return "Use Bomb A e Bomb B como referência.";
    const normalized = normalize(mapName);
    const callouts = MAP_CALLOUTS[normalized];
    return callouts ? callouts.join(', ') : "Use Bomb A e Bomb B como referência.";
}

/**
 * Returns the full arsenal for coach context.
 */
export function getFullArsenal() {
    return Object.entries(ARSENAL)
        .map(([cat, weapons]) => `${cat.toUpperCase()}: ${weapons.join(', ')}`)
        .join(' | ');
}

/**
 * Returns tactical obligations for a given role.
 */
export function getRoleObligations(role) {
    if (!role) return null;
    const normalized = normalize(role);
    return ROLE_OBLIGATIONS[normalized] || null;
}

// --- LLM CONTEXT BUILDER ---

/**
 * Builds a dense tactical context for LLM prompt injection.
 */
export function buildTacticalContext({ map, agent }) {
    const agentData = getAgent(agent);
    const normalizedMap = normalize(map);
    const mapMeta = MAP_META[normalizedMap] || {};
    const sites = getValidSites(map);
    const callouts = MAP_CALLOUTS[normalizedMap] || [];
    const roleData = agentData ? getRoleObligations(agentData.role) : null;
    const synergy = agentData ? AGENT_SYNERGY[normalize(agentData.name)] : null;
    
    return {
        timestamp: new Date().toISOString(),
        version: KNOWLEDGE_VERSION,
        map: {
            name: map,
            sites,
            meta: mapMeta,
            callouts: callouts.slice(0, 8) // Limit to top callouts for context efficiency
        },
        agent: agentData ? {
            name: agentData.name,
            role: agentData.role,
            tags: agentData.tags,
            abilities: agentData.abilities,
            synergy: synergy
        } : null,
        role_obligations: roleData,
        general_context: {
            round_strategies: ROUND_CONTEXT,
            arsenal_summary: "Rifles (Vandal/Phantom) e Sidearms são prioridade de análise."
        }
    };
}
