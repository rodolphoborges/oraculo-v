import { supabase } from '../lib/supabase.js';

async function checkRecentMatchCounts() {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    console.log(`🔍 Checking matches since: ${fortyEightHoursAgo}`);

    const { count, error } = await supabase
        .from('match_analysis_queue')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', fortyEightHoursAgo);

    if (error) {
        console.error('❌ Error checking queue:', error.message);
        return;
    }

    console.log(`📅 Matches in queue from last 48h: ${count}`);

    const { data: samples } = await supabase
        .from('match_analysis_queue')
        .select('match_id, agente_tag, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

    console.log('\n--- Recent samples ---');
    console.log(JSON.stringify(samples, null, 2));
}

checkRecentMatchCounts();
