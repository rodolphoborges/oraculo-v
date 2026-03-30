import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const protocolo = createClient(process.env.PROTOCOL_SUPABASE_URL, process.env.PROTOCOL_SUPABASE_KEY);

async function findValidMatch() {
    console.log('Buscando match_id válido no Protocolo-V...');
    const { data: matches, error } = await protocolo.from('matches').select('id').limit(1);
    
    if (error) {
        console.error('Erro ao buscar matches:', error.message);
    } else if (matches && matches.length > 0) {
        console.log('Match ID VÁLIDO encontrado:', matches[0].id);
    } else {
        console.log('Nenhum match encontrado na tabela matches.');
    }
}

findValidMatch();
