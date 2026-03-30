import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const protocolo = createClient(process.env.PROTOCOL_SUPABASE_URL, process.env.PROTOCOL_SUPABASE_KEY);

async function testWriteRead() {
    console.log('Teste de ESCRITA/LEITURA no Protocolo-V...');
    const testId = '00000000-0000-0000-0000-000000000000';
    const testPlayer = 'TESTE#123';

    // 1. Inserir
    console.log('Inserindo registro de teste...');
    const { data: insData, error: insErr } = await protocolo.from('match_analysis_queue').upsert([{
        match_id: testId,
        player_id: testPlayer,
        status: 'pending'
    }], { onConflict: 'match_id, player_id' }).select();

    if (insErr) {
        console.error('Erro na escrita:', insErr.message);
    } else {
        console.log('Sucesso na escrita. Retorno:', insData);
    }

    // 2. Selecionar
    console.log('Lendo todos os registros...');
    const { data: selData, error: selErr } = await protocolo.from('match_analysis_queue').select('*');
    if (selErr) {
        console.error('Erro na leitura:', selErr.message);
    } else {
        console.log(`Sucesso na leitura. Encontrados: ${selData.length} registros.`);
        console.table(selData);
    }
}

testWriteRead();
