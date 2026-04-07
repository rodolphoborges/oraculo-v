
import { supabase } from '../lib/supabase.js';

async function forceReset() {
    console.log('📡 [RESET] Buscando jobs não-completados...');
    
    const { data: jobs, error } = await supabase
        .from('match_analysis_queue')
        .select('id, status');

    if (error) {
        console.error('❌ Erro:', error.message);
        return;
    }

    const pendingJobs = jobs.filter(j => j.status !== 'completed');
    console.log(`📦 Encontrados ${pendingJobs.length} jobs para resetar.`);

    for (const job of pendingJobs) {
        const { error: updErr } = await supabase
            .from('match_analysis_queue')
            .update({ 
                status: 'pending', 
                error_message: null,
                processed_at: null,
                retry_count: 0
            })
            .eq('id', job.id);

        if (updErr) {
            console.warn(`   ⚠️ Erro no ID ${job.id}: ${updErr.message}`);
        } else {
            console.log(`   ✅ ID ${job.id} resetado.`);
        }
    }

    console.log('🏁 [RESET] Fila pronta para o Worker.');
}

forceReset();
