import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
    const { data, error } = await supabase
        .from('ai_insights')
        .select('*')
        .eq('match_id', 'b56f4740-e11a-45d5-a966-6f58789ec616')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Supabase Error:", error);
    } else {
        console.log("AI Insights for match b56f...:");
        console.log(JSON.stringify(data, null, 2));
    }
}

check();
