import { supabase, supabaseProtocol } from '../lib/supabase.js';
import { generateInsights } from '../lib/openrouter_engine.js';

async function processMatch() {
    const matchId = 'b321fc60-a15f-441d-8ba3-7ec0dc11fe0b';
    console.log(`🚀 [FORCE-AI] Processando Prioritariamente: ${matchId}`);

    const { data: queueItems } = await supabase
        .from('match_analysis_queue')
        .select('*')
        .eq('match_id', matchId)
        .eq('status', 'completed');

    if (!queueItems || queueItems.length === 0) {
        console.error("❌ Erro: Nenhuma tarefa concluída encontrada para esta partida.");
        return;
    }

    // Buscar quem já tem insight
    const { data: existingInsights } = await supabase
        .from('ai_insights')
        .select('player_id')
        .eq('match_id', matchId);

    const hasInsight = new Set(existingInsights?.map(i => i.player_id.toUpperCase()) || []);

    for (const job of queueItems) {
        if (hasInsight.has(job.agente_tag.toUpperCase())) {
            console.log(`⏩ [SKIP] ${job.agente_tag} já possui insight.`);
            continue;
        }

        console.log(`👷 [AI-GEN] Gerando para: ${job.agente_tag}`);
        const result = job.metadata?.analysis;
        if (!result) continue;

        // Mock para trend se não encontrar (só para agilizar)
        const promptData = {
            match_data: {
                agent: result.agent, map: result.map,
                perf: result.performance_index,
                kd: result.kd, acs: result.acs,
                total_rounds: result.total_rounds,
                conselhosBase: result.all_conselhos
            },
            trend: "Análise Sequencial",
            history: null,
            squad: null
        };

        const aiResponse = await generateInsights(promptData);
        if (aiResponse) {
            console.log(`✅ [OK] ${job.agente_tag} -> Insight gerado.`);
            
            await supabase.from('ai_insights').insert([{
                match_id: matchId,
                player_id: job.agente_tag,
                insight_resumo: aiResponse.insight,
                model_used: aiResponse.model_used
            }]);

            if (supabaseProtocol) {
                await supabaseProtocol.from('ai_insights').upsert([{
                    match_id: matchId,
                    player_id: job.agente_tag,
                    insight_resumo: aiResponse.insight,
                    model_used: aiResponse.model_used
                }], { onConflict: 'match_id,player_id' });
                console.log(`📡 [SYNC] ${job.agente_tag} enviado para o Protocolo-V.`);
            }
        } else {
          console.warn(`❌ [FAIL] ${job.agente_tag} -> Erro na IA.`);
        }
    }
}

processMatch();
