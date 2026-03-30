import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const matchId = 'b321fc60-a15f-441d-8ba3-7ec0dc11fe0b';
const players = [
    'm4sna#chama',
    'ALEGRIA#021',
    'Vduart#MEE',
    'DefeitoDeFabrica#ZzZ'
];

const protocolo = createClient(process.env.PROTOCOL_SUPABASE_URL, process.env.PROTOCOL_SUPABASE_KEY);

async function forceRequeue() {
    console.log(`Forçando re-fila para partida ${matchId}...`);
    
    const jobs = players.map(p => ({
        match_id: matchId,
        player_id: p,
        status: 'pending',
        created_at: new Date().toISOString()
    }));

    const { error } = await protocolo.from('match_analysis_queue').upsert(jobs, { onConflict: 'match_id, player_id' });
    
    if (error) {
        console.error('Erro ao inserir na fila:', error);
    } else {
        console.log(`✅ ${jobs.length} jogadores colocados na fila com sucesso.`);
    }
}

forceRequeue();
