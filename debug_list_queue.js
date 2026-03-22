import { supabase } from './lib/supabase.js';

async function listQueue() {
    console.log("Listing queue content...");
    const { data, error } = await supabase
        .from('match_analysis_queue')
        .select('*');

    if (error) {
        console.error("Error:", error.message);
    } else {
        console.log(`Queue size: ${data.length}`);
        data.forEach(row => {
            console.log(`ID: ${row.id} | Match: ${row.match_id} | Player: ${row.agente_tag} | Status: ${row.status}`);
        });
    }
}

listQueue();
