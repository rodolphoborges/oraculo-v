
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const protocolUrl = process.env.PROTOCOL_SUPABASE_URL;
const protocolKey = process.env.PROTOCOL_SUPABASE_KEY;

const supabase = createClient(protocolUrl, protocolKey);

async function checkPending() {
    console.log('Checking remaining pending jobs in the queue...');
    const { data: queue, error } = await supabase
        .from('match_analysis_queue')
        .select('player_tag, match_id')
        .eq('status', 'pending');

    if (error) {
        console.error('Error fetching queue:', error.message);
    } else {
        console.log(`Total Pending: ${queue.length}`);
        queue.forEach(q => console.log(` - ${q.player_tag}: ${q.match_id}`));
    }
}

checkPending();
