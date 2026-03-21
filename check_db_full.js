import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
    const { data, error } = await supabase
        .from('match_analysis_queue')
        .select('match_id, status, error_msg');

    if (error) console.error(error);
    console.log(JSON.stringify(data, null, 2));
}

check();
