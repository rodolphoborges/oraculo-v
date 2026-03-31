
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const protocolUrl = process.env.PROTOCOL_SUPABASE_URL;
const protocolKey = process.env.PROTOCOL_SUPABASE_KEY;

const supabase = createClient(protocolUrl, protocolKey);

async function debugStuckJobs() {
    console.log('Checking stuck jobs (MAHORAGA#CHESS and ALEGRIA#021)...');
    const { data: jobs, error } = await supabase
        .from('match_analysis_queue')
        .select('*')
        .in('player_tag', ['MAHORAGA#CHESS', 'ALEGRIA#021'])
        .eq('status', 'processing');

    if (error) {
        console.error('Error fetching jobs:', error.message);
    } else if (jobs && jobs.length > 0) {
        console.log(`Found ${jobs.length} stuck jobs in status 'processing'.`);
        console.log(JSON.stringify(jobs, null, 2));

        console.log('Resetting jobs to pending...');
        const { error: updateErr } = await supabase
            .from('match_analysis_queue')
            .update({ status: 'pending', error_msg: 'RESET_STUCK_JOB' })
            .in('id', jobs.map(j => j.id));

        if (updateErr) {
            console.error('Error resetting jobs:', updateErr.message);
        } else {
            console.log('Jobs successfully reset to pending.');
        }
    } else {
        console.log('No stuck jobs found in status processing for these players.');
    }
}

debugStuckJobs();
