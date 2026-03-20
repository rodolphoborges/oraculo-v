import { supabase } from './supabase.js';

/**
 * Busca as estatísticas de meta para um agente, mapa e rank específicos.
 * @param {string} agentName - Nome do agente (ex: 'Clove', 'Jett')
 * @param {string} mapName - Nome do mapa (ex: 'Ascent', 'Breeze')
 * @param {string} rankTier - Rank (ex: 'Radiant', 'Immortal', 'ALL')
 * @returns {Promise<Object|null>} Estatísticas do agente ou null se não encontrado.
 */
export async function getAgentMeta(agentName, mapName = 'ALL', rankTier = 'ALL') {
  try {
    const { data, error } = await supabase
      .from('raw_meta_snapshots')
      .select('data_payload')
      .eq('rank_tier', rankTier)
      .eq('map_name', mapName)
      .contains('data_payload', { table_type: 'agents' })
      .order('captured_at', { ascending: false })
      .limit(1);

    if (error) throw error;
    if (!data || data.length === 0) return null;

    const results = data[0].data_payload.results;
    
    // Busca o agente em qualquer campo (devido a possíveis mudanças no vStats/Scraper)
    const agentStats = results.find(r => {
      return Object.values(r).some(val => 
        typeof val === 'string' && val.toLowerCase() === agentName.toLowerCase()
      );
    });

    if (!agentStats) return null;

    // Tenta identificar o KD (valor numérico próximo a 1.0 ou formato de KD)
    // Se o mapeamento estiver quebrado, o KD costuma estar em 'matches' ou 'kd'
    let kdValue = 1.0;
    const possibleKd = agentStats.matches || agentStats.kd;
    
    if (possibleKd) {
      // Converte "0,94" ou "1.05" para float
      kdValue = parseFloat(possibleKd.replace(',', '.'));
      
      // Heurística: se o valor for > 15, provavelmente é uma porcentagem (WinRate)
      // O KD real costuma estar entre 0.5 e 2.0
      if (kdValue > 5) {
        // Se pegamos o WinRate por engano, tenta o outro campo
        const altKd = agentStats.matches; 
        if (altKd && parseFloat(altKd.replace(',', '.')) < 5) {
          kdValue = parseFloat(altKd.replace(',', '.'));
        }
      }
    }

    return {
      agent: agentName,
      kd: kdValue,
      matches: agentStats.matches
    };
  } catch (err) {
    console.error('Erro ao buscar meta no Supabase:', err.message);
    return null;
  }
}

/**
 * Busca estatísticas de múltiplos rankings para comparação técnica.
 * @param {string} agentName 
 * @param {string} mapName 
 * @returns {Promise<Array>} Lista de { rank, kd }
 */
export async function getRankBaselines(agentName, mapName = 'ALL') {
  const ranks = ['GOLD', 'DIAMOND', 'RADIANT'];
  const baselines = [];

  for (const rank of ranks) {
    const meta = await getAgentMeta(agentName, mapName, rank);
    if (meta) {
      baselines.push({ rank, kd: meta.kd });
    }
  }

  // Fallback se não encontrar os ranks específicos na base local
  if (baselines.length === 0) {
    baselines.push(
      { rank: 'OURO', kd: 1.00 },
      { rank: 'DIAMANTE', kd: 1.10 },
      { rank: 'RADIANTE', kd: 1.25 }
    );
  }

  return baselines;
}
