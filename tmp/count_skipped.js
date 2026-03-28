import { supabase } from '../lib/supabase.js';

async function countBlankMatches() {
    console.log('🔍 Buscando dimensão das partidas "congeladas"...');

    // Matches que pulamos no reset de hoje
    const { count: skippedCount, error: err1 } = await supabase
        .from('match_analysis_queue')
        .select('*', { count: 'exact', head: true })
        .like('error_message', '%Skipped - Historical%');
        
    console.log(`🧊 Partidas puladas (Skipped > 48h): ${skippedCount}`);

    // Quantas partidas totais temos na fila
    const { count: total, error: err2 } = await supabase
        .from('match_analysis_queue')
        .select('*', { count: 'exact', head: true });
        
    console.log(`📦 Total na fila: ${total}`);

    // Quantos AI insights existem
    const { count: insights, error: err3 } = await supabase
        .from('ai_insights')
        .select('*', { count: 'exact', head: true });
        
    console.log(`🧠 AI Insights gerados: ${insights}`);
}

countBlankMatches();
