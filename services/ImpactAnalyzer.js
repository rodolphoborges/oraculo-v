import { getAgent, calculatePerformanceScore, normalize } from '../lib/tactical_knowledge.js';

/**
 * ImpactAnalyzer.js (V3 - Engine Sync)
 * 
 * Cálculo dinâmico de Impacto com normalização de métricas e pesos por função (Role).
 * Sincronizado com o motor tático central.
 */
class ImpactAnalyzer {
    /**
     * Calcula o Score de Impacto (I) Normalizado (0-100)
     */
    static calculate(stats) {
        let { adr = 0, kast = 0, first_bloods = 0, clutches = 0, acs = 0, agent = '', role = '', performance_index = null } = stats;

        // 1. Identificação da Função (Role) via Engine Central
        const agentData = getAgent(agent);
        let resolvedRole = role || (agentData ? agentData.role : 'Default');
        
        // 2. Cálculo do Score (Prioriza o Índice Pré-Calculado da Análise vStats)
        let finalScore;
        if (performance_index !== null && typeof performance_index === 'number') {
            finalScore = Math.min(100, Math.max(0, performance_index));
        } else {
            // Fallback para cálculo interno se não houver índice prévio
            finalScore = calculatePerformanceScore({
                adr, kast, first_bloods, clutches, acs
            }, resolvedRole);
        }

        // 3. Classificação e Tom de Voz (Refinado - Narrativa Coach)
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
