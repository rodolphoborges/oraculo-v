import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const protocolo = createClient(process.env.PROTOCOL_SUPABASE_URL, process.env.PROTOCOL_SUPABASE_KEY);

async function findColumns() {
    console.log('Buscando colunas reais via Postgrest Metadata...');
    // Tentamos um truque: pedir o OpenAPI schema do Postgrest
    try {
        const resp = await fetch(`${process.env.PROTOCOL_SUPABASE_URL}/rest/v1/?apikey=${process.env.PROTOCOL_SUPABASE_KEY}`);
        const schema = await resp.json();
        const table = schema.definitions.match_analysis_queue;
        if (table) {
            console.log('Colunas encontradas no Schema Definitions:');
            console.log(Object.keys(table.properties));
        } else {
            console.log('Tabela não encontrada no Schema definitions.');
        }
    } catch (e) {
        console.error('Erro ao buscar schema:', e.message);
    }
}

findColumns();
