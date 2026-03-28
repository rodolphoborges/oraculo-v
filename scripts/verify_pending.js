import { supabase } from '../lib/supabase.js';

async function verify() {
    const { data, count, error } = await supabase
        .from('match_analysis_queue')
        .select('*', { count: 'exact', head: true })
        .eq('agente_tag', 'm4sna#chama')
        .eq('status', 'pending');
    
    if (error) {
        console.error("❌ Erro:", error.message);
    } else {
        console.log(`📊 Partidas PENDENTES para M4SNA: ${count}`);
    }
}

verify();
