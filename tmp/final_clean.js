
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const protocolUrl = process.env.PROTOCOL_SUPABASE_URL;
const protocolKey = process.env.PROTOCOL_SUPABASE_KEY;

const supabase = createClient(protocolUrl, protocolKey);

async function finalCleanup() {
    console.log('Performing final surgical cleanup for Guxxtavo#easy in queue...');
    const { count, error } = await supabase
        .from('match_analysis_queue')
        .delete({ count: 'exact' })
        .ilike('player_tag', 'Guxxtavo#easy');

    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log(`Successfully removed ${count} remaining invalid jobs from the queue.`);
    }
}

finalCleanup();
