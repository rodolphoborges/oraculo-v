import dotenv from 'dotenv';
dotenv.config({ quiet: true });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

/**
 * recover_queue.js
 * 
 * Identifica jobs que estão em 'processing' por muito tempo (> 15 min)
 * e os reseta para 'pending' ou marca como 'failed'.
 */

async function recover() {
    console.log("🛠️ [RECOVERY] Verificando jobs travados em 'processing'...");

    // Definir o limite de tempo (15 minutos atrás)
    const staleThreshold = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    // 1. Buscar jobs 'processing' que parecem travados
    // Tentamos pelo processed_at, e se for null, pelo created_at
    const { data: staleJobs, error } = await supabase
        .from('match_analysis_queue')
        .select('*')
        .eq('status', 'processing')
        .or(`processed_at.lt.${staleThreshold},and(processed_at.is.null,created_at.lt.${staleThreshold})`);

    if (error) {
        console.error("❌ Erro ao buscar jobs travados:", error);
        return;
    }

    if (!staleJobs || staleJobs.length === 0) {
        console.log("✅ Nenhum job travado encontrado.");
        return;
    }

    console.log(`⚠️ Encontrados ${staleJobs.length} jobs possivelmente travados.`);

    for (const job of staleJobs) {
        console.log(`🔄 Resetando Job ${job.id} (Match: ${job.match_id}) para 'pending'...`);
        
        // Resetamos para 'pending' para que o worker tente novamente
        // Opcionalmente, poderíamos marcar como 'failed' se já tentou muitas vezes
        await supabase.from('match_analysis_queue').update({ 
            status: 'pending',
            error_msg: 'Job reset by recovery script (stale processing)',
            processed_at: null 
        }).eq('id', job.id);
    }

    console.log("✅ Recuperação concluída.");
}

recover();
