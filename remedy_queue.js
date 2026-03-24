import { supabase } from './lib/supabase.js';

async function remedy() {
    console.log("🛠️ [REMEDY] Iniciando correção da fila...");

    // 1. Limpar mensagens de erro de jobs completados
    const { error: err1 } = await supabase
        .from('match_analysis_queue')
        .update({ error_message: null })
        .eq('status', 'completed');

    if (err1) console.error("❌ Erro ao limpar mensagens de jobs completados:", err1.message);
    else console.log("✅ Mensagens de erro de jobs 'completed' limpas.");

    // 2. Corrigir jobs marcados como 'failed' mas que possuem análise
    const { data: ghosts, error: err2 } = await supabase
        .from('match_analysis_queue')
        .select('id, metadata')
        .eq('status', 'failed');

    if (err2) {
        console.error("❌ Erro ao buscar jobs fantasmagóricos:", err2.message);
    } else if (ghosts && ghosts.length > 0) {
        let fixedCount = 0;
        for (const job of ghosts) {
            if (job.metadata && job.metadata.analysis) {
                const { error: upErr } = await supabase
                    .from('match_analysis_queue')
                    .update({ 
                        status: 'completed', 
                        error_message: null 
                    })
                    .eq('id', job.id);
                if (!upErr) fixedCount++;
            }
        }
        console.log(`✅ ${fixedCount} jobs 'failed' com análise foram corrigidos para 'completed'.`);
    } else {
        console.log("✅ Nenhum job 'failed' com análise encontrado.");
    }
}

remedy();
