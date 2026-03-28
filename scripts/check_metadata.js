import { supabase } from '../lib/supabase.js';

async function check() {
    const { data: matches } = await supabase
        .from('match_analysis_queue')
        .select('metadata, match_id')
        .eq('agente_tag', 'm4sna#chama')
        .eq('status', 'completed')
        .order('created_at', { ascending: true })
        .limit(1);
    
    if (matches && matches.length > 0) {
        console.log("✅ Match 1 Metadata:", JSON.stringify(matches[0].metadata, null, 2));
    } else {
        console.log("❌ Nenhuma partida completada encontrada.");
    }
}

check();
