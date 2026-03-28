import { supabase } from '../lib/supabase.js';

async function check() {
    const { data, error } = await supabase
        .from('match_analysis_queue')
        .select('*')
        .limit(10);
    
    if (error) {
        console.error("❌ Erro:", error.message);
    } else {
        console.log("📊 Amostra de jobs:", data.map(j => ({ tag: j.agente_tag, match: j.match_id })));
    }
}

check();
