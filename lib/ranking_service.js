/**
 * Estima o ranking técnico do jogador baseado no impacto (K/D e ADR) 
 * comparado com baselines reais do vStats.
 * 
 * @param {number} actualKd - K/D da partida atual
 * @param {number} actualAdr - ADR da partida atual
 * @param {Array} baselines - Lista de { rank, kd, adr }
 * @returns {string} Rank estimado (ex: 'DIAMANTE')
 */
export function estimateTechnicalRank(actualKd, actualAdr, baselines) {
  let estimatedRank = 'PRATA/BRONZE';
  
  // Ordena baselines por um "Score de Impacto" (do maior rank pro menor)
  const sortedBaselines = [...baselines].sort((a, b) => {
    const scoreA = (a.kd || 1.0) + (a.adr || 135) / 100;
    const scoreB = (b.kd || 1.0) + (b.adr || 135) / 100;
    return scoreB - scoreA;
  });
  
  for (const b of sortedBaselines) {
    // Cálculo de Ratio Ponderado: 40% KD, 60% ADR
    const kdRatio = actualKd / (b.kd || 1.0);
    const adrRatio = actualAdr / (b.adr || 135);
    const combinedImpact = (kdRatio * 0.4) + (adrRatio * 0.6);
    
    if (combinedImpact >= 0.97) {
      estimatedRank = b.rank;
      break;
    }
  }
  
  return estimatedRank;
}
