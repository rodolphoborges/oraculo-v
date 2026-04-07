
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!url || !key) {
    console.error('❌ Supabase URL ou KEY ausentes.');
    process.exit(1);
}

const supabase = createClient(url, key);

async function forcePending() {
    console.log('📡 [FORCE] Iniciando reset da fila...');
    
    // 1. Busca todos os ids que não são 'completed'
    const { data: jobs, error: fetchErr } = await supabase
        .from('match_analysis_queue')
        .select('id, status')
        .neq('status', 'completed');

    if (fetchErr) {
        console.error('❌ Erro na busca:', fetchErr.message);
        return;
    }

    console.log(`📦 Encontrados ${jobs.length} jobs para forçar 'pending'.`);

    for (const job of jobs) {
        console.log(`   ➡️  Forçando ID ${job.id} para PENDING...`);
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
            console.error(`   ❌ Falha no ID ${job.id}: ${updErr.message}`);
        } else {
            console.log(`   ✅ ID ${job.id}: OK.`);
        }
    }

    console.log('🏁 [FORCE] Reset completo.');
    
    // Verificação final
    const { data: final } = await supabase
        .from('match_analysis_queue')
        .select('status')
        .eq('status', 'pending');
        
    console.log(`📊 VALIDAÇÃO FINAL: ${final.length} jobs em 'pending'.`);
}

forcePending();
