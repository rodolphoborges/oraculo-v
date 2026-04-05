import { supabaseProtocol } from './lib/supabase.js';

async function recoverProcessingJobs() {
    if (!supabaseProtocol) {
        console.error("❌ Erro: Cliente Protocolo-V (supabaseProtocol) não está configurado.");
        return;
    }

    console.log("🛠️ [RECOVERY] Iniciando recuperação de jobs travados em 'processing'...");

    // Consideramos travado se estiver em 'processing' há mais de 10 minutos
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data: stuckJobs, error: fetchError } = await supabaseProtocol
        .from('match_analysis_queue')
        .select('id, player_tag, match_id, created_at')
        .eq('status', 'processing')
        .lt('created_at', tenMinutesAgo);

    if (fetchError) {
        console.error("❌ Erro ao buscar jobs travados:", fetchError.message);
        return;
    }

    if (!stuckJobs || stuckJobs.length === 0) {
        console.log("✅ Nenhum job 'processing' antigo encontrado.");
        return;
    }

    console.log(`🔍 Encontrados ${stuckJobs.length} jobs travados. Resetando para 'pending'...`);

    for (const job of stuckJobs) {
        console.log(`  - Resetando ID: ${job.id} (${job.player_tag} | Match: ${job.match_id}) [Criado em: ${job.created_at}]`);
        
        const { error: updateError } = await supabaseProtocol
            .from('match_analysis_queue')
            .update({ 
                status: 'pending',
                error_msg: '[AUTO-RECOVERY] Job estava travado em processing por mais de 10 minutos.'
            })
            .eq('id', job.id);

        if (updateError) {
            console.error(`    ❌ Falha ao resetar job ${job.id}:`, updateError.message);
        } else {
            console.log(`    ✅ Job ${job.id} resetado.`);
        }
    }

    console.log("🏁 [RECOVERY] Finalizado.");
}

recoverProcessingJobs();
