import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const protocolo = createClient(process.env.PROTOCOL_SUPABASE_URL, process.env.PROTOCOL_SUPABASE_KEY);

async function checkCatalog() {
    console.log('Inspecionando catálogo pg_attribute...');
    // Se tivermos permissão, consultamos o catálogo.
    // Mas geralmente não temos via Postgrest.
    
    // TRUQUE: Inserir com um objeto VAZIO e ver se o erro lista as colunas sugeridas
    // Ou usar o RPC genérico se existir
    const { error } = await protocolo.from('match_analysis_queue').insert({});
    if (error) {
        console.log('Erro retornado:', error.message);
        if (error.hint) console.log('DICA:', error.hint);
    }
}

checkCatalog();
