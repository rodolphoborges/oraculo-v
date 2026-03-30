import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

async function inspectSchemaProperties() {
    console.log('Inspecionando propriedades da fila no Postgrest...');
    try {
        const resp = await fetch(`${process.env.PROTOCOL_SUPABASE_URL}/rest/v1/`, {
            headers: { 'apikey': process.env.PROTOCOL_SUPABASE_KEY }
        });
        const schema = await resp.json();
        const props = schema.definitions.match_analysis_queue.properties;
        console.log('--- COLUNAS REAIS NO BANCO ---');
        console.log(Object.keys(props));
        console.log('----------------------------');
    } catch (e) {
        console.error('Erro:', e.message);
    }
}

inspectSchemaProperties();
