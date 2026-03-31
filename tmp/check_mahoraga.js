
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const protocolUrl = process.env.PROTOCOL_SUPABASE_URL;
const protocolKey = process.env.PROTOCOL_SUPABASE_KEY;

const supabase = createClient(protocolUrl, protocolKey);

async function checkMahoraga() {
    console.log('Checking for any job for MAHORAGA#CHESS...');
    const { data: jobs, error } = await supabase
        .from('match_analysis_queue')
        .select('*')
        .ilike('player_tag', 'MAHORAGA#CHESS');

    if (error) {
        console.error('Error fetching jobs:', error.message);
    } else {
        console.log(`Found ${jobs.length} jobs for Mahoraga.`);
        console.log(JSON.stringify(jobs, null, 2));
        
        // Reset if processing
        const stuckJobs = jobs.filter(j => j.status === 'processing');
        if (stuckJobs.length > 0) {
            console.log('Resetting processing jobs for Mahoraga to pending...');
            const { error: resetErr } = await supabase
                .from('match_analysis_queue')
                .update({ status: 'pending', error_msg: 'RESET_STUCK_JOB' })
                .in('id', stuckJobs.map(j => j.id));
            if (resetErr) console.error('Error resetting:', resetErr.message);
            else console.log('Successfully reset Mahoraga jobs to pending.');
        }
    }
}

checkMahoraga();
