/**
 * analyze_valorant.js
 * 
 * Motor tático portado de Python para JS nativo.
 * Mantém paridade com a Doutrina Protocolo-V (ADR, FB, Sinergia, Holt-Winters).
 */

const AGENT_ROLE_MAP = {
    "jett": "Duelista", "raze": "Duelista", "phoenix": "Duelista",
    "reyna": "Duelista", "yoru": "Duelista", "neon": "Duelista",
    "iso": "Duelista", "waylay": "Duelista",
    "sova": "Iniciador", "breach": "Iniciador", "skye": "Iniciador",
    "kayo": "Iniciador", "kay/o": "Iniciador", "fade": "Iniciador",
    "gekko": "Iniciador", "tejo": "Iniciador",
    "brimstone": "Controlador", "viper": "Controlador", "omen": "Controlador",
    "astra": "Controlador", "harbor": "Controlador", "clove": "Controlador",
    "miks": "Controlador",
    "sage": "Sentinela", "cypher": "Sentinela", "killjoy": "Sentinela",
    "chamber": "Sentinela", "deadlock": "Sentinela", "vyse": "Sentinela",
    "veto": "Sentinela",
};

const ROLE_THRESHOLDS = {
    "Duelista": { adr_baseline: 150.0, adr_min: 100, kast_min: 60, fb_excellence: 3, fb_min: 1, kd_weight: 0.45, adr_weight: 0.55, kast_weight: 0.0 },
    "Iniciador": { adr_baseline: 100.0, adr_min: 65, kast_min: 68, fb_excellence: 2, fb_min: 0, kd_weight: 0.20, adr_weight: 0.30, kast_weight: 0.50 },
    "Controlador": { adr_baseline: 85.0, adr_min: 55, kast_min: 72, fb_excellence: 1, fb_min: 0, kd_weight: 0.15, adr_weight: 0.20, kast_weight: 0.65 },
    "Sentinela": { adr_baseline: 88.0, adr_min: 55, kast_min: 68, fb_excellence: 1, fb_min: 0, kd_weight: 0.15, adr_weight: 0.20, kast_weight: 0.65 },
};

export function resolveRole(agentName, roleOverride) {
    if (agentName) {
        const roleFromAgent = AGENT_ROLE_MAP[agentName.toLowerCase()];
        if (roleFromAgent) return roleFromAgent;
    }
    if (roleOverride && roleOverride.toLowerCase() !== "unknown" && roleOverride !== "") {
        return roleOverride.charAt(0) + roleOverride.slice(1).toLowerCase();
    }
    return "Duelista";
}

export function calculatePerformanceIndex(kdActual, targetKd, adr, role, kast, firstBloods) {
    const rt = ROLE_THRESHOLDS[role] || ROLE_THRESHOLDS["Duelista"];
    const kdPerf = targetKd > 0 ? (kdActual / targetKd) : 1.0;
    const adrPerf = adr / rt.adr_baseline;
    const kastPerf = kast !== null ? (kast / 100.0) : 0.7;
    const perfIdx = (rt.kd_weight * kdPerf * 100 + rt.adr_weight * adrPerf * 100 + rt.kast_weight * kastPerf * 100);
    return Math.round(perfIdx * 10) / 10;
}

export function processRounds(matchData, playerTag) {
    const segments = matchData.data.segments;
    const metadata = matchData.data.metadata;
    const totalRounds = metadata.rounds;
    
    // Normalização Resiliente (Paridade Python line 229)
    const targetPlayerUpper = playerTag.replace(/\s/g, "").toUpperCase();
    const targetPrefix = targetPlayerUpper.split('#')[0];

    const findSegmentForPlayer = (type, roundNum) => {
        return segments.find(s => {
            if (s.type !== type) return false;
            if (roundNum && s.attributes?.round !== roundNum) return false;
            
            const ident = (s.attributes?.platformUserIdentifier || s.metadata?.platformUserIdentifier || "").replace(/\s/g, "").toUpperCase();
            return ident === targetPlayerUpper || ident.split('#')[0] === targetPrefix || ident.includes(targetPrefix);
        });
    };

    const playerSummary = findSegmentForPlayer('player-summary');
    if (!playerSummary) throw new Error(`Jogador ${playerTag} não encontrado na partida.`);

    const targetIdUsed = (playerSummary.attributes?.platformUserIdentifier || playerSummary.metadata?.platformUserIdentifier || "").toUpperCase();
    
    // Mapeamento de agentes
    const playerAgents = {};
    segments.forEach(s => {
        if (s.type === 'player-summary') {
            const pid = (s.attributes.platformUserIdentifier || s.metadata.platformUserIdentifier || "").toUpperCase();
            if (pid) playerAgents[pid] = s.metadata.agentName || 'Unknown';
        }
    });

    const allKills = segments.filter(s => s.type === 'player-round-kills').sort((a, b) => a.metadata.roundTime - b.metadata.roundTime);

    let firstKills = 0;
    let firstDeaths = 0;
    const roundsAnalysis = [];

    for (let r = 1; r <= totalRounds; r++) {
        const roundKills = allKills.filter(k => k.attributes.round === r);
        const playerRound = findSegmentForPlayer('player-round', r);
        
        if (!playerRound) continue;

        let playerKillsInRound = 0;
        let playerDied = false;
        let isFirstBlood = false;
        let isFirstDeath = false;

        const events = [];
        roundKills.forEach((k, idx) => {
            const killer = (k.attributes.platformUserIdentifier || "").toUpperCase();
            const victim = (k.attributes.opponentPlatformUserIdentifier || "").toUpperCase();
            
            const isKiller = killer === targetIdUsed || killer.startsWith(targetPrefix);
            const isVictim = victim === targetIdUsed || victim.startsWith(targetPrefix);

            if (isKiller) playerKillsInRound++;
            if (isVictim) playerDied = true;

            if (idx === 0) {
                if (isKiller) { isFirstBlood = true; firstKills++; }
                if (isVictim) { isFirstDeath = true; firstDeaths++; }
            }

            if (isKiller || isVictim) {
                events.push({
                    time: k.metadata.roundTime,
                    weapon: k.metadata.weaponName,
                    killerAgent: playerAgents[killer] || 'Inimigo',
                    victimAgent: playerAgents[victim] || 'Inimigo',
                    isPlayerKiller: isKiller
                });
            }
        });

        let comment = "Sem eventos críticos.";
        if (isFirstBlood) comment = `Abriu o mapa com First Blood sobre ${events[0].victimAgent}.`;
        else if (isFirstDeath) comment = `Neutralizado precocemente por ${events[0].killerAgent}.`;
        else if (playerKillsInRound > 1) comment = `Multi-kill detectado (${playerKillsInRound}x).`;
        else if (playerKillsInRound === 1) comment = `Garantiu o frag de ${events.find(e => e.isPlayerKiller).victimAgent}.`;

        roundsAnalysis.push({
            round: r,
            kills: playerKillsInRound,
            died: playerDied,
            comment,
            fb: isFirstBlood,
            fd: isFirstDeath,
            events
        });
    }

    return { roundsAnalysis, firstKills, firstDeaths };
}

export function calculateHoltWinters(metrics, holtPrev) {
    const alpha = 0.4;
    const beta = 0.2;
    const holtNext = {};
    
    Object.entries(metrics).forEach(([m, y_t]) => {
        const L_prev = holtPrev[`${m}_l`];
        const T_prev = holtPrev[`${m}_t`];
        
        if (L_prev !== undefined && L_prev !== null && T_prev !== undefined && T_prev !== null) {
            const L_t = alpha * y_t + (1 - alpha) * (L_prev + T_prev);
            const T_t = beta * (L_t - L_prev) + (1 - beta) * T_prev;
            const forecast = L_t + T_t;
            holtNext[`${m}_l`] = L_t;
            holtNext[`${m}_t`] = T_t;
            holtNext[`${m}_forecast`] = forecast;
        } else {
            holtNext[`${m}_l`] = null;
            holtNext[`${m}_t`] = null;
        }
    });

    return holtNext;
}

export function generateTacticalInsights(perfIdx, role, metrics, holtNext) {
    const rt = ROLE_THRESHOLDS[role] || ROLE_THRESHOLDS["Duelista"];
    const conselhos = [];

    if (holtNext.performance_t !== null) {
        const t = holtNext.performance_t;
        if (t > 0.5) conselhos.push(`TENDÊNCIA POSITIVA: Performance Index cresceu +${t.toFixed(1)} ponto(s)/partida.`);
        else if (t < -0.5) conselhos.push(`TENDÊNCIA NEGATIVA: Performance Index caiu ${Math.abs(t).toFixed(1)} ponto(s)/partida.`);
    }

    if (metrics.adr < rt.adr_min) conselhos.push(`VIOLAÇÃO: ADR abaixo de ${rt.adr_min} para ${role}. Impacto insuficiente.`);
    if (metrics.firstBloods >= rt.fb_excellence) conselhos.push(`EXCELÊNCIA: ${metrics.firstBloods} First Bloods garantidos.`);

    let technicalRank = "Depósito de Torreta";
    if (perfIdx >= 115) technicalRank = "Alpha";
    else if (perfIdx >= 95) technicalRank = "Omega";

    return {
        conselho: conselhos.length > 0 ? conselhos[0] : "Protocolo V cumprido. Continue operando.",
        allConselhos: conselhos,
        technicalRank
    };
}
