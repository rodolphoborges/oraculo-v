import { supabase } from '../lib/supabase.js';

/**
 * reset_failed.js
 * 
 * Move todos os jobs com status 'failed' de volta para 'pending'
 * para que o worker tente processá-los novamente.
 */

async function reset() {
    console.log("🛠️ [RESET] Buscando jobs com falha no Supabase...");

    const { data: failedJobs, error } = await supabase
        .from('match_analysis_queue')
        .select('id, match_id, agente_tag')
        .eq('status', 'failed');

    if (error) {
        console.error("❌ Erro ao buscar jobs com falha:", error.message);
        return;
    }

    if (!failedJobs || failedJobs.length === 0) {
        console.log("✅ Nenhum job com falha encontrado.");
        return;
    }

    console.log(`⚠️ Encontrados ${failedJobs.length} jobs com falha.`);

    const { error: upError } = await supabase
        .from('match_analysis_queue')
        .update({ 
            status: 'pending', 
            error_message: null,
            processed_at: null 
        })
        .eq('status', 'failed');

    if (upError) {
        console.error("❌ Erro ao resetar jobs:", upError.message);
    } else {
        console.log(`🚀 SUCESSO! ${failedJobs.length} jobs voltaram para 'pending'.`);
        console.log("Inicie o worker (node worker.js) para processar os itens resetados.");
    }
}

reset();
