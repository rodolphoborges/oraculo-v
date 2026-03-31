
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const protocolUrl = process.env.PROTOCOL_SUPABASE_URL;
const protocolKey = process.env.PROTOCOL_SUPABASE_KEY;

const supabase = createClient(protocolUrl, protocolKey);

async function checkPlayers() {
    const players = ['MAHORAGA#CHESS', 'ALEGRIA#021'];
    console.log(`Checking existence for: ${players.join(', ')}`);
    
    const { data, error } = await supabase
        .from('players')
        .select('riot_id')
        .in('riot_id', players);

    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log('Found in players table:');
        data.forEach(p => console.log(` - ${p.riot_id}`));
    }
}

checkPlayers();
