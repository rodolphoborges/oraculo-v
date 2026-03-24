import { supabase } from './lib/supabase.js';

async function verify() {
    const { count, error } = await supabase
        .from('match_analysis_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
    
    if (error) {
        console.error("❌ Erro:", error.message);
    } else {
        console.log(`📊 TOTAL de partidas PENDENTES no Oráculo-V: ${count}`);
    }
}

verify();
