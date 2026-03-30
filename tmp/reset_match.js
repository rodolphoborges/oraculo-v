import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const matchId = 'b321fc60-a15f-441d-8ba3-7ec0dc11fe0b';

const oraculo = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const protocolo = createClient(process.env.PROTOCOL_SUPABASE_URL, process.env.PROTOCOL_SUPABASE_KEY);

async function reset() {
    console.log(`Resetando partida ${matchId}...`);
    
    // 1. Deletar de ai_insights (Oráculo-V)
    const { error: err1 } = await oraculo.from('ai_insights').delete().eq('match_id', matchId);
    if (err1) console.error('Erro ao deletar ai_insights:', err1);
    else console.log('OK: ai_insights limpo.');

    // 2. Resetar status na fila (Protocolo-V)
    const { error: err2 } = await protocolo.from('match_analysis_queue').update({ status: 'pending' }).eq('match_id', matchId);
    if (err2) console.error('Erro ao resetar fila:', err2);
    else console.log('OK: Fila resetada para "pending".');
}

reset();
