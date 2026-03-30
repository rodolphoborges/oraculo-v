import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const protocolo = createClient(process.env.PROTOCOL_SUPABASE_URL, process.env.PROTOCOL_SUPABASE_KEY);

async function inspectColumns() {
    console.log('Inspecionando todas as colunas da fila...');
    // Tentamos inserir um teste e pegar o retorno
    const { data, error } = await protocolo.from('match_analysis_queue').upsert([{
        match_id: '00000000-0000-0000-0000-000000000001',
        agente_tag: 'INSPECT#001',
        status: 'pending'
    }], { onConflict: 'match_id, agente_tag' }).select();

    if (error) {
        console.error('Erro:', error.message);
    } else {
        console.log('Colunas detectadas:', Object.keys(data[0] || {}));
        console.log('Valores:', data[0]);
    }
}

inspectColumns();
