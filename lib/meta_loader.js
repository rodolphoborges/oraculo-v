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
    const agentStats = results.find(r => {
      const agent = r.agent || '';
      const agents = r.agents || '';
      return agent.toLowerCase() === agentName.toLowerCase() || 
             agents.toLowerCase().includes(agentName.toLowerCase());
    });

    if (!agentStats) return null;

    return {
      agent: agentName,
      winRate: parseFloat(agentStats.winRate),
      kd: parseFloat(agentStats.kd),
      matches: agentStats.matches
    };
  } catch (err) {
    console.error('Erro ao buscar meta no Supabase:', err.message);
    return null;
  }
}
