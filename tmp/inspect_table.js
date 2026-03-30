import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const protocolo = createClient(process.env.PROTOCOL_SUPABASE_URL, process.env.PROTOCOL_SUPABASE_KEY);

async function inspectTable() {
    console.log('Inspecionando tabela match_analysis_queue...');
    const { data: cols, error } = await protocolo.rpc('get_table_columns_info', { t_name: 'match_analysis_queue' });
    
    if (error) {
        // Se a RPC não existir, tentamos um select * de 1 linha
        const { data, error: err2 } = await protocolo.from('match_analysis_queue').select('*').limit(1);
        if (err2) {
            console.error('Erro ao ler tabela:', err2);
        } else {
            console.log('Colunas encontradas:', Object.keys(data[0] || {}));
        }
    } else {
        console.table(cols);
    }
}

inspectTable();
