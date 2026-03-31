
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const protocolUrl = process.env.SUPABASE_URL; // Using Oráculo-V database for AI insights
const protocolKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(protocolUrl, protocolKey);

async function checkInsights() {
    const matchId = '5660ca26-8e21-40bc-bfd6-8bd2a85c1409';
    console.log(`Checking insights for match ${matchId}...`);
    
    const { data, error } = await supabase
        .from('ai_insights')
        .select('*')
        .eq('match_id', matchId);

    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log(`Found ${data.length} insights for this match.`);
        data.forEach(i => console.log(` - ${i.player_id}: ${i.model_used}`));
    }
}

checkInsights();
