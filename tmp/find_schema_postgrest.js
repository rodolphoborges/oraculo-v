import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const protocolo = createClient(process.env.PROTOCOL_SUPABASE_URL, process.env.PROTOCOL_SUPABASE_KEY);

async function findTableSchema() {
    console.log('Buscando esquema da tabela match_analysis_queue...');
    // Tentamos usar o RPC openapi se existir
    try {
        const resp = await fetch(`${process.env.PROTOCOL_SUPABASE_URL}/rest/v1/`, {
            headers: { 'apikey': process.env.PROTOCOL_SUPABASE_KEY }
        });
        const schema = await resp.json();
        console.log('Tabelas detectadas pelo Postgrest:');
        console.log(Object.keys(schema.definitions || {}));
    } catch (e) {
        console.error('Erro ao consultar rest/v1/:', e.message);
    }
}

findTableSchema();
