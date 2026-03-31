
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const protocolUrl = process.env.PROTOCOL_SUPABASE_URL;
const protocolKey = process.env.PROTOCOL_SUPABASE_KEY;

const supabase = createClient(protocolUrl, protocolKey);

async function checkMahoraga() {
    console.log('Searching for any player with Mahoraga (ilike)...');
    const { data: players, error } = await supabase
        .from('players')
        .select('riot_id')
        .ilike('riot_id', '%Mahoraga%');

    if (error) {
        console.error('Error fetching players:', error.message);
    } else if (players && players.length > 0) {
        console.log('Found Mahoraga players:');
        players.forEach(p => console.log(` - ${p.riot_id}`));
    } else {
        console.log('Mahoraga not found in players table.');
    }
}

checkMahoraga();
