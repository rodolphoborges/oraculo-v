import { supabase } from '../lib/supabase.js';

async function resetFakeSuccess() {
    console.log("🔍 [REMEDIATION] Buscando jobs com 'Falso Positivo'...");
    
    // 1. Buscar todos os jobs 'completed'
    const { data: completedJobs, error } = await supabase
        .from('match_analysis_queue')
        .select('id, match_id, agente_tag, metadata')
        .eq('status', 'completed');

    if (error) {
        console.error("❌ Erro ao buscar jobs:", error.message);
        return;
    }

    const toReset = [];

    for (const job of completedJobs) {
        // Verificar se há insight correspondente no Oráculo-V
        const { data: insight } = await supabase
            .from('ai_insights')
            .select('id')
            .eq('match_id', job.match_id)
            .eq('player_id', job.agente_tag)
            .single();

        // Se o job está completed mas não tem insight, é um falso positivo
        if (!insight) {
            console.log(`⚠️ Job ${job.id} (Match: ${job.match_id}, Player: ${job.agente_tag}) marcado como completo mas sem IA. Resetando...`);
            toReset.push(job.id);
        }
    }

    if (toReset.length > 0) {
        console.log(`🔄 Resetando ${toReset.length} jobs para 'pending'...`);
        const { error: updateErr } = await supabase
            .from('match_analysis_queue')
            .update({ 
                status: 'pending', 
                processed_at: null,
                error_message: null
            })
            .in('id', toReset);

        if (updateErr) console.error("❌ Erro ao resetar jobs:", updateErr.message);
        else console.log("✅ Remediacão concluída com sucesso.");
    } else {
        console.log("✨ Nenhum falso positivo encontrado.");
    }
}

resetFakeSuccess();
