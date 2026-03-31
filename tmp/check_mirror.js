
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const protocolUrl = process.env.PROTOCOL_SUPABASE_URL; // Checking Protocolo-V database mirror
const protocolKey = process.env.PROTOCOL_SUPABASE_KEY;

const supabase = createClient(protocolUrl, protocolKey);

async function checkMirror() {
    const matchId = '5660ca26-8e21-40bc-bfd6-8bd2a85c1409';
    console.log(`Checking mirrored insights for match ${matchId}...`);
    
    const { data, error } = await supabase
        .from('ai_insights')
        .select('player_id, match_id, created_at')
        .eq('match_id', matchId);

    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log(`Found ${data.length} mirrored insights.`);
        data.forEach(i => console.log(` - ${i.player_id}: ${i.created_at}`));
    }
}

checkMirror();
