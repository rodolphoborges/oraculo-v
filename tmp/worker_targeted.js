import { supabase, supabaseProtocol } from '../lib/supabase.js';
import { runAnalysis } from '../analyze_match.js';
import { generateInsights } from '../lib/openrouter_engine.js';

async function processTargeted(matchId) {
    console.log(`🎯 [TARGETED-WORKER] Iniciando processamento direcionado para Match: ${matchId}`);

    // Buscar todos os jobs pendentes deste match
    const { data: jobs, error } = await supabase
        .from('match_analysis_queue')
        .select('*')
        .eq('match_id', matchId)
        .eq('status', 'pending');

    if (error || !jobs || jobs.length === 0) {
        console.error("❌ Nenhum job pendente encontrado para este match ou erro:", error?.message);
        return;
    }

    console.log(`📌 Encontrados ${jobs.length} jobs para processar (Fade e Sage).`);

    for (const job of jobs) {
        if (job.agente_tag === 'AUTO') {
            console.log("⏩ Ignorando job AUTO.");
            continue;
        }

        console.log(`\n👷 Processando Agente: ${job.agente_tag}...`);
        
        try {
            // 1. Marcar como processing
            await supabase.from('match_analysis_queue').update({ status: 'processing', processed_at: new Date().toISOString() }).eq('id', job.id);

            // 2. Rodar Motor de Análise
            const result = await runAnalysis(job.agente_tag, job.match_id);
            if (result.error) throw new Error(result.error);
            console.log("✅ Análise base (Motor Python) OK.");

            // 3. Gerar Insights com IA (Novo Prompt/Filtros)
            const promptData = {
                match_data: {
                    agent: result.agent, map: result.map,
                    perf: result.performance_index,
                    kd: result.kd, acs: result.acs,
                    total_rounds: result.total_rounds,
                    conselhosBase: result.all_conselhos
                },
                trend: "Dados de treino em refino operacional",
                history: null
            };

            console.log("🧠 Gerando Inteligência via OpenRouter...");
            const aiResponse = await generateInsights(promptData);

            if (aiResponse) {
                console.log(`✅ Insight aprovado via Quality Guard (${aiResponse.model_used}).`);
                
                // Gravação Local (Oráculo-V)
                await supabase.from('ai_insights').insert([{
                    match_id: job.match_id,
                    player_id: job.agente_tag,
                    insight_resumo: aiResponse.insight,
                    model_used: aiResponse.model_used
                }]);

                // SINCRONIZAÇÃO DUAL-BASE: Gravação no Protocolo-V (Dashboard)
                if (supabaseProtocol) {
                    console.log(`📡 [SYNC] Sincronizando insight para o Protocolo-V...`);
                    await supabaseProtocol.from('ai_insights').insert([{
                        match_id: job.match_id,
                        player_id: job.agente_tag,
                        insight_resumo: aiResponse.insight,
                        model_used: aiResponse.model_used
                    }]);
                }

                // 4. Marcar como complete
                await supabase.from('match_analysis_queue').update({ 
                    status: 'completed',
                    metadata: { 
                        ...job.metadata, 
                        agent: result.agent, 
                        map: result.map,
                        perf: result.performance_index,
                        analysis: result,
                        ai_generated: true,
                        finished_at: new Date().toISOString()
                    }
                }).eq('id', job.id);
                
                console.log("🏁 Finalizado com sucesso.");
            } else {
                throw new Error("Quality Guard rejeitou todas as saídas da IA.");
            }

        } catch (err) {
            console.error(`❌ Falha no job: ${err.message}`);
            await supabase.from('match_analysis_queue').update({ status: 'failed', error_message: err.message }).eq('id', job.id);
        }
    }
}

// Rodar apenas para o match solicitado
processTargeted('b56f4740-e11a-45d5-a966-6f58789ec616');
