
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const protocolUrl = process.env.PROTOCOL_SUPABASE_URL;
const protocolKey = process.env.PROTOCOL_SUPABASE_KEY;

const supabase = createClient(protocolUrl, protocolKey);

async function checkColumns() {
    console.log('Checking match_analysis_queue table columns...');
    const { data: sample, error } = await supabase
        .from('match_analysis_queue')
        .select('*')
        .limit(1)
        .single();

    if (error) {
        console.error('Error fetching sample:', error.message);
    } else {
        console.log('Sample record keys:', Object.keys(sample));
    }
}

checkColumns();
