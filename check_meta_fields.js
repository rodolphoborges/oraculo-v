import { supabase } from './lib/supabase.js';

async function check() {
    const { data: matches } = await supabase
        .from('match_analysis_queue')
        .select('metadata')
        .eq('agente_tag', 'm4sna#chama')
        .eq('status', 'completed')
        .order('created_at', { ascending: true })
        .limit(1);
    
    if (matches && matches.length > 0) {
        const meta = matches[0].metadata;
        console.log("✅ Perf:", meta.perf);
        console.log("✅ Analysis KD:", meta.analysis?.kd);
        console.log("✅ Analysis ADR:", meta.analysis?.adr);
    }
}

check();
