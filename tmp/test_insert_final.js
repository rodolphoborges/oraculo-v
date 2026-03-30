import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const protocolo = createClient(process.env.PROTOCOL_SUPABASE_URL, process.env.PROTOCOL_SUPABASE_KEY);

async function testInsert() {
    console.log('Testando INSERT na fila...');
    const { data, error } = await protocolo.from('match_analysis_queue').insert([{
        match_id: '11111111-1111-1111-1111-111111111111',
        player_tag: 'TESTE_FINAL#000',
        status: 'pending'
    }]);

    if (error) {
        console.error('ERRO NO INSERT:', error.message);
        if (error.hint) console.log('DICA:', error.hint);
    } else {
        console.log('✅ INSERT aparente sucesso (Data:', data, ')');
    }
}

testInsert();
