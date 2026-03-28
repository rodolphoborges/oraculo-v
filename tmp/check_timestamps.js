import { supabase } from '../lib/supabase.js';

const MATCH_ID = 'ed99d061-40a6-410c-91d5-d4ca0d1f9117';

async function checkTimestamps() {
    const { data } = await supabase
        .from('match_analysis_queue')
        .select('agente_tag, status, processed_at, metadata')
        .eq('match_id', MATCH_ID);
    
    data.forEach(q => {
        console.log(`\n👤 Player: ${q.agente_tag}`);
        console.log(`   Status: ${q.status}`);
        console.log(`   Processed At: ${q.processed_at}`);
        console.log(`   Finished At: ${q.metadata?.finished_at}`);
    });
}

checkTimestamps();
