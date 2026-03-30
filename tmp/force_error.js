import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const protocolo = createClient(process.env.PROTOCOL_SUPABASE_URL, process.env.PROTOCOL_SUPABASE_KEY);

async function forceError() {
    console.log('Induzindo erro de schema...');
    // Tentamos inserir um campo inexistente para ver se ele lista os campos válidos no erro
    const { error } = await protocolo.from('match_analysis_queue').insert({ 
        __non_existent_column__: true 
    });
    
    if (error) {
        console.error('Erro retornado:', error.message);
        if (error.hint) console.log('Dica:', error.hint);
    }
}

forceError();
