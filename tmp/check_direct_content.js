import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const protocolo = createClient(process.env.PROTOCOL_SUPABASE_URL, process.env.PROTOCOL_SUPABASE_KEY);

async function checkDirect() {
    console.log('Verificando conteúdo direto da match_analysis_queue...');
    const { data, error } = await protocolo.from('match_analysis_queue').select('*');
    if (error) {
        console.error('Erro:', error.message);
    } else {
        console.log('Total de registros:', data.length);
        console.log('Conteúdo:', JSON.stringify(data, null, 2));
    }
}

checkDirect();
