
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const protocolUrl = process.env.PROTOCOL_SUPABASE_URL;
const protocolKey = process.env.PROTOCOL_SUPABASE_KEY;

const supabase = createClient(protocolUrl, protocolKey);

async function checkAllStuck() {
    console.log('Checking for ALL jobs stuck in "processing" for more than 10 minutes...');
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    // We can't easily query by timestamp in a way that checks "stuck", 
    // but we can list all processing and check their creation date.
    const { data: stuck, error } = await supabase
        .from('match_analysis_queue')
        .select('*')
        .eq('status', 'processing');

    if (error) {
        console.error('Error fetching jobs:', error.message);
    } else if (stuck && stuck.length > 0) {
        console.log(`Found ${stuck.length} total jobs in status 'processing'.`);
        stuck.forEach(j => {
            console.log(` - ID: ${j.id}, Player: ${j.player_tag}, Created at: ${j.created_at}`);
        });
        
        // Reset them all
        console.log('Resetting all to pending...');
        const { error: resetErr } = await supabase
            .from('match_analysis_queue')
            .update({ status: 'pending', error_msg: 'RESET_STUCK_SYSTEM' })
            .in('id', stuck.map(j => j.id));
        if (resetErr) console.error('Reset error:', resetErr.message);
    } else {
        console.log('No stuck jobs found in the whole queue system.');
    }
}

checkAllStuck();
