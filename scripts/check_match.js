import { supabase } from './lib/supabase.js';

async function check() {
    const { data, error } = await supabase
        .from('match_analysis_queue')
        .select('agente_tag, status')
        .eq('match_id', '2c7944be-f3c4-4429-a0fa-8d3604acd7a7');
    
    if (error) {
        console.error("❌ Erro:", error.message);
    } else {
        console.log("✅ Match info:", data);
    }
}

check();
