import { supabase } from '../lib/supabase.js';

async function check() {
    const { data, error } = await supabase
        .from('match_analysis_queue')
        .select('*')
        .limit(1);
    
    if (error) {
        console.error("❌ Erro:", error.message);
    } else {
        console.log("✅ Colunas:", Object.keys(data[0] || {}));
    }
}

check();
