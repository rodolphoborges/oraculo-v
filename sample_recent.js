import { supabase } from './lib/supabase.js';

async function check() {
    const { data, error } = await supabase
        .from('match_analysis_queue')
        .select('*')
        .eq('status', 'completed')
        .order('processed_at', { ascending: false })
        .limit(5);
    
    if (error) {
        console.error("❌ Erro:", error.message);
    } else {
        console.log("📊 Amostra de resultados recentes:");
        data.forEach(j => {
            console.log(`- Match: ${j.match_id} | Player: ${j.agente_tag}`);
            console.log(`  Holt: ${JSON.stringify(j.metadata.holt, null, 2)}`);
        });
    }
}

check();
