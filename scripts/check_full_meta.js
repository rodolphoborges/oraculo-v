import { supabase } from './lib/supabase.js';

async function check() {
    const { data, error } = await supabase
        .from('match_analysis_queue')
        .select('metadata->perf, metadata->analysis->kd, metadata->analysis->adr')
        .eq('match_id', '008c8374-3b19-4e3a-bfb1-b773b28e5c60')
        .eq('agente_tag', 'm4sna#chama')
        .single();
    
    if (error) {
        console.error("❌ Erro:", error.message);
    } else {
        console.log("✅ Data Keys:", Object.keys(data));
        console.log("✅ Data Content:", JSON.stringify(data, null, 2));
    }
}

check();
