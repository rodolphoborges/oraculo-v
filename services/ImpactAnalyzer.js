/**
 * ImpactAnalyzer.js (V2 - Senior)
 * 
 * Cálculo dinâmico de Impacto com normalização de métricas e pesos por função (Role).
 * Desenvolvido para o ecossistema Protocolo-V / Oráculo-V.
 */
class ImpactAnalyzer {
    /**
     * Mapeamento de Agentes para Funções (Roles)
     */
    static ROLE_MAPPING = {
        // Duelistas
        'Jett': 'Duelista', 'Raze': 'Duelista', 'Phoenix': 'Duelista', 'Reyna': 'Duelista',
        'Yoru': 'Duelista', 'Neon': 'Duelista', 'Iso': 'Duelista', 'Waylay': 'Duelista',
        // Iniciadores
        'Sova': 'Iniciador', 'Skye': 'Iniciador', 'Breach': 'Iniciador', 'KAY/O': 'Iniciador',
        'Fade': 'Iniciador', 'Gekko': 'Iniciador', 'Tejo': 'Iniciador',
        // Controladores
        'Omen': 'Controlador', 'Brimstone': 'Controlador', 'Viper': 'Controlador',
        'Astra': 'Controlador', 'Harbor': 'Controlador', 'Clove': 'Controlador', 'Miks': 'Controlador',
        // Sentinelas
        'Killjoy': 'Sentinela', 'Sage': 'Sentinela', 'Cypher': 'Sentinela',
        'Chamber': 'Sentinela', 'Deadlock': 'Sentinela', 'Vyse': 'Sentinela', 'Veto': 'Sentinela'
    };

    /**
     * Pesos Dinâmicos por Função (W1:ADR, W2:KAST, W3:FB, W4:Clutches, W5:ACS)
     */
    static WEIGHTS = {
        'Duelista':   { adr: 0.3, kast: 0.1, fb: 0.4, clutch: 0.05, acs: 0.15 },
        'Iniciador':  { adr: 0.1, kast: 0.4, fb: 0.1, clutch: 0.10, acs: 0.30 },
        'Controlador': { adr: 0.1, kast: 0.5, fb: 0.05, clutch: 0.30, acs: 0.05 },
        'Sentinela':  { adr: 0.2, kast: 0.4, fb: 0.05, clutch: 0.20, acs: 0.15 },
        'Default':    { adr: 0.2, kast: 0.2, fb: 0.2, clutch: 0.20, acs: 0.20 }
    };

    /**
     * Calcula o Score de Impacto (I) Normalizado (0-100)
     */
    static calculate(stats) {
        let { adr = 0, kast = 0, first_bloods = 0, clutches = 0, acs = 0, agent = '', role = '' } = stats;

        // 1. Identificação da Função (Role)
        let resolvedRole = role || this.ROLE_MAPPING[agent] || 'Default';
        const w = this.WEIGHTS[resolvedRole] || this.WEIGHTS['Default'];

        // 2. Normalização de Métricas (Escala 0-100)
        // ADR (Teto 220), FB (Teto 6), Clutch (Teto 3), ACS (Teto 350)
        const nADR = Math.min(100, (adr / 220) * 100);
        const nKAST = Math.min(100, kast); // Já é percentual 0-100
        const nFB = Math.min(100, (first_bloods / 6) * 100);
        const nClutch = Math.min(100, (clutches / 3) * 100);
        const nACS = Math.min(100, (acs / 350) * 100);

        // 3. Aplicação da Fórmula: I = Σ(Wi * Ni)
        const I = (w.adr * nADR) + (w.kast * nKAST) + (w.fb * nFB) + (w.clutch * nClutch) + (w.acs * nACS);
        const finalScore = Math.round(I * 10) / 10;

        // 4. Classificação e Tom de Voz (Refinado - Narrativa Coach)
        let rank = 'Depósito de Torreta';
        let tone = `O jogador foi um peso morto. Faça um trash talk citando que o uso de [Keywords] foi vergonhoso. Mencione que até o ferro 1 teria uma leitura de jogo melhor.`;
        
        if (finalScore >= 80) {
            rank = 'Alpha';
            tone = `O jogador brilhou de [Agente]. Use termos como [Keywords] para elogiar como ele dominou o mapa hoje.`;
        } else if (finalScore >= 50) {
            rank = 'Omega';
            tone = `Aja como um Coach Analítico. O desempenho foi consistente, mas sem o brilho do rank Alpha. Use [Keywords] de forma técnica.`;
        }

        return {
            score: finalScore,
            rank: rank,
            role: resolvedRole,
            tone_instruction: tone
        };
    }
}

export default ImpactAnalyzer;
