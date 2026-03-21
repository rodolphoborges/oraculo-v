import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function listTables() {
    const { data: tables, error } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');

    if (error) {
        console.error("❌ Erro ao listar tabelas via RPC/Query:");
        console.error(error);
        
        // Tentativa alternativa via query direta se RPC não estiver disponível
        const { data: qData, error: qError } = await supabase.rpc('get_tables');
        if (qError) {
             console.error("❌ Erro ao tentar RPC 'get_tables':", qError);
        } else {
             console.log("📊 Tabelas (via RPC):", qData);
        }
    } else {
        console.log("📊 Tabelas encontradas:");
        console.table(tables);
    }
}

listTables();
