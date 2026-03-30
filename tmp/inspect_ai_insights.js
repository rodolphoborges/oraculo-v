import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

async function inspectAiInsights() {
    console.log('Inspecionando ai_insights no Postgrest...');
    try {
        const resp = await fetch(`${process.env.PROTOCOL_SUPABASE_URL}/rest/v1/`, {
            headers: { 'apikey': process.env.PROTOCOL_SUPABASE_KEY }
        });
        const schema = await resp.json();
        const props = schema.definitions.ai_insights.properties;
        console.log('--- COLUNAS AI_INSIGHTS ---');
        console.log(Object.keys(props));
        console.log('----------------------------');
    } catch (e) {
        console.error('Erro:', e.message);
    }
}

inspectAiInsights();
