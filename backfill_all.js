import { supabase } from './lib/supabase.js';
import { runAnalysis } from './analyze_match.js';

/**
 * backfill_all.js
 * 
 * Reprocessa todas as análises completadas para garantir que todos os registros
 * possuam as métricas novas (FK, FD, matches_analyzed) e a nomenclatura lore-friendly.
 */

async function backfill() {
    console.log("🚀 Iniciando Backfill Global do Oráculo-V...\n");

    const { data: jobs, error } = await supabase
        .from('match_analysis_queue')
        .select('*')
        .eq('status', 'completed')
        .order('created_at', { ascending: true });

    if (error) {
        console.error("❌ Erro ao buscar registros:", error.message);
        return;
    }

    console.log(`📊 Encontrados ${jobs.length} registros para reprocessamento.`);

    for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        process.stdout.write(`[${i + 1}/${jobs.length}] Reprocessando ${job.agente_tag} (${job.match_id})... `);

        try {
            // Re-executa a análise. 
            // O runAnalysis agora inclui internamente a busca pelo contexto estratégico 
            // e os novos cálculos de FK/FD/Lore.
            const result = await runAnalysis(job.agente_tag, job.match_id, 'ALL', 'ALL', {});

            const { error: updateError } = await supabase
                .from('match_analysis_queue')
                .update({
                    metadata: {
                        ...job.metadata,
                        agent: result.agent,
                        map: result.map,
                        perf: result.performance_index,
                        holt: result.holt,
                        analysis: result
                    }
                })
                .eq('id', job.id);

            if (updateError) {
                console.log(`❌ Erro: ${updateError.message}`);
            } else {
                console.log(`✅ Sucesso.`);
            }
        } catch (err) {
            console.log(`❌ Falha: ${err.message}`);
        }

        // Respiro para evitar rate limit de APIs externas (Tracker/Supabase)
        await new Promise(res => setTimeout(res, 200));
    }

    console.log("\n🏁 Backfill finalizado. Base sanitizada com sucesso.");
}

backfill();
