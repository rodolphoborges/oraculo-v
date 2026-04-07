
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!url || !key) {
    console.error('❌ Supabase URL ou KEY ausentes.');
    process.exit(1);
}

const supabase = createClient(url, key, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function adminReset() {
    console.log('📡 [ADMIN] Iniciando reset administrativo da fila...');
    
    // 1. Força o status para pending e limpa erros
    // Usando range global para garantir que pegamos tudo que não é 'completed'
    const { data, count, error } = await supabase
        .from('match_analysis_queue')
        .update({ 
            status: 'local_pending', 
            error_message: null,
            processed_at: null,
            retry_count: 0
        })
        .neq('status', 'completed')
        .select('*', { count: 'exact' });

    if (error) {
        console.error('❌ Erro no Reset:', error.message);
        process.exit(1);
    }

    console.log(`✅ Sucesso! ${count} jobs foram resetados para 'pending'.`);
    process.exit(0);
}

adminReset();
