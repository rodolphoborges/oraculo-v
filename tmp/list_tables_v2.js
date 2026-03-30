import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const protocolo = createClient(process.env.PROTOCOL_SUPABASE_URL, process.env.PROTOCOL_SUPABASE_KEY);

async function listTables() {
    console.log('Listando tabelas no Protocolo-V...');
    // Tentamos um RPC genérica ou uma tabela de sistema
    const { data, error } = await protocolo.rpc('get_table_columns_info', { t_name: 'match_analysis_queue' });
    
    // Se a RPC falhar, tentamos dar um select em pg_catalog via RPC se houver uma de "query"
    // Caso contrário, tentamos selecionar de uma tabela que SABEMOS que existe (match_stats)
    const { data: d2, error: err2 } = await protocolo.from('match_stats').select('*').limit(1);
    if (d2) console.log('Tabela match_stats existe.');
    
    const { data: d3, error: err3 } = await protocolo.from('match_analysis_queue').select('*').limit(1);
    if (err3) console.log('Erro match_analysis_queue:', err3.message);
    else console.log('Tabela match_analysis_queue existe.');
}

listTables();
