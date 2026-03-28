import { supabase } from '../lib/supabase.js';

async function check() {
    const { data, error } = await supabase
        .from('match_analysis_queue')
        .select('metadata')
        .eq('match_id', '3fbb19d7-c933-4e88-853c-c00402b63629')
        .eq('agente_tag', 'm4sna#chama')
        .single();
    
    if (error) {
        console.error("❌ Erro:", error.message);
    } else {
        console.log("✅ Holt Data (Match 4):", JSON.stringify(data.metadata.holt, null, 2));
    }
}

check();
