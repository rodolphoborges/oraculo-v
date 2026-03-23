import { supabase, supabaseProtocol } from './supabase.js';

/**
 * strategic_advisor.js
 * 
 * Provides high-level tactical and strategic insights by aggregating
 * historical performance data for players and squads.
 */

export async function getStrategicContext(agenteTag, matchId) {
    const context = {
        bestAgents: [],
        squadSynergy: null,
        overallAvgPerf: 0,
        matchesAnalyzed: 0
    };

    try {
        // 1. Get Historical Agent Performance
        const { data: matches } = await supabase
            .from('match_analysis_queue')
            .select('metadata')
            .eq('agente_tag', agenteTag)
            .eq('status', 'completed')
            .order('created_at', { ascending: false })
            .limit(50);

        if (matches && matches.length > 0) {
            const agentStats = matches.reduce((acc, curr) => {
                const agent = curr.metadata?.agent || 'Unknown';
                const perf = curr.metadata?.perf || 0;
                if (agent !== 'Unknown' && perf > 0) {
                    acc[agent] = acc[agent] || { totalPerf: 0, count: 0 };
                    acc[agent].totalPerf += perf;
                    acc[agent].count += 1;
                }
                return acc;
            }, {});

            context.bestAgents = Object.entries(agentStats)
                .map(([agent, stats]) => ({
                    agent,
                    avgPerf: stats.totalPerf / stats.count,
                    count: stats.count
                }))
                .sort((a, b) => b.avgPerf - a.avgPerf);
            
            context.overallAvgPerf = matches.reduce((acc, curr) => acc + (curr.metadata?.perf || 0), 0) / matches.length;
            context.matchesAnalyzed = matches.length;
        }

        // 2. Get Current Squad Synergy
        const { data: squadMembers } = await supabaseProtocol
            .from('operation_squads')
            .select('riot_id')
            .eq('operation_id', matchId);

        if (squadMembers && squadMembers.length > 1) {
            const partners = squadMembers
                .map(m => m.riot_id)
                .filter(tag => tag !== agenteTag);
            
            // For now, only identification of partners. 
            // Future: Calculate historical performance with these specific partners.
            context.squadPartners = partners;
        }

    } catch (err) {
        console.error("⚠️ [STRATEGIC] Erro ao carregar contexto:", err.message);
    }

    return context;
}
