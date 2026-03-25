import { supabase } from '../lib/supabase.js';

/**
 * repair_truncated_jobs.js
 * 
 * Identifica análises que foram salvas incompletas (sem a propriedade 'rounds')
 * e as reseta para 'pending', forçando o worker a re-processar com o novo código.
 */

async function repair() {
    console.log("🛠️ [REPARAÇÃO] Buscando jobs truncados no Supabase...");

    const { data: jobs, error } = await supabase
        .from('match_analysis_queue')
        .select('id, metadata')
        .eq('status', 'completed');

    if (error) {
        console.error("❌ Erro ao buscar jobs:", error);
        return;
    }

    const truncatedIds = jobs
        .filter(j => !j.metadata?.analysis?.rounds) // Filtra quem não tem a lista de rounds
        .map(j => j.id);

    if (truncatedIds.length === 0) {
        console.log("✅ Nenhuma análise truncada encontrada. Todas parecem completas!");
        return;
    }

    console.log(`⚠️ Encontrados ${truncatedIds.length} jobs truncados (ex: ${truncatedIds.slice(0, 5).join(', ')}...).`);

    const { status, error: upError } = await supabase
        .from('match_analysis_queue')
        .update({ 
            status: 'pending', 
            error_message: 'Repair: Re-processing truncated analysis' 
        })
        .in('id', truncatedIds);

    if (upError) {
        console.error("❌ Erro ao resetar jobs:", upError);
    } else {
        console.log(`🚀 SUCESSO! ${truncatedIds.length} jobs voltaram para 'pending'.`);
        console.log("Inicie o worker (node worker.js) para processá-los com o novo código!");
    }
}

repair();
