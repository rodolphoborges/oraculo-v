import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const protocolo = createClient(process.env.PROTOCOL_SUPABASE_URL, process.env.PROTOCOL_SUPABASE_KEY);

async function getSchema() {
    console.log('Consultando information_schema para match_analysis_queue...');
    const { data, error } = await protocolo.rpc('execute_sql_query', { 
        sql_query: "SELECT column_name FROM information_schema.columns WHERE table_name = 'match_analysis_queue';" 
    });
    
    if (error) {
        // Se a RPC no Protocolo não tiver execute_sql_query, vamos tentar um truque:
        // Selecionar de uma linha inexistente e ver o erro ou o schema retornado pelo postgrest
        const { data: d2, error: err2 } = await protocolo.from('match_analysis_queue').select('*').limit(0);
        if (err2) {
            console.error('Erro ao ler schema:', err2);
        } else {
            console.log('Colunas (via select limit 0):', data);
        }
    } else {
        console.table(data);
    }
}

getSchema();
