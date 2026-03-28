import { supabase } from '../lib/supabase.js';

async function debugQueue() {
    const matchId = 'b56f4740-e11a-45d5-a966-6f58789ec616';
    
    console.log(`🔎 Debugging Queue for ${matchId}...`);
    const { data, error } = await supabase
        .from('match_analysis_queue')
        .select('*')
        .eq('match_id', matchId);

    if (error) {
        console.error('❌ Error:', error.message);
        return;
    }

    console.log(JSON.stringify(data, null, 2));
}

debugQueue();
