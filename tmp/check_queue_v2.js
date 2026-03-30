import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const protocolo = createClient(process.env.PROTOCOL_SUPABASE_URL, process.env.PROTOCOL_SUPABASE_KEY);

async function checkQueue() {
    console.log('Verificando fila no Protocolo-V...');
    const { data, error } = await protocolo.from('match_analysis_queue').select('*').limit(10);
    
    if (error) {
        console.error('Erro ao buscar fila:', error);
    } else {
        console.log(`Encontrados ${data.length} registros na fila.`);
        console.table(data);
    }
}

checkQueue();
