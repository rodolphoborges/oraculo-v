import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const protocolo = createClient(process.env.PROTOCOL_SUPABASE_URL, process.env.PROTOCOL_SUPABASE_KEY);

async function checkPlayerColumn() {
    console.log('Testando player_id...');
    const { error: err1 } = await protocolo.from('match_analysis_queue').insert({ 
        match_id: '00000000-0000-0000-0000-000000000000',
        player_id: 'TESTE#123' 
    });
    if (err1) console.log('ERRO com player_id:', err1.message);

    console.log('Testando agente_tag...');
    const { error: err2 } = await protocolo.from('match_analysis_queue').insert({ 
        match_id: '00000000-0000-0000-0000-000000000000',
        agente_tag: 'TESTE#123' 
    });
    if (err2) console.log('ERRO com agente_tag:', err2.message);
}

checkPlayerColumn();
