import { supabase, supabaseProtocol } from '../lib/supabase.js';

async function checkMatch() {
    const matchId = 'ed99d061-40a6-410c-91d5-d4ca0d1f9117';
    console.log(`🔍 [DEBUG] Verificando match: ${matchId}`);

    const { data: queueData, error: qErr } = await supabase.from('match_analysis_queue')
        .select('agente_tag, status, error_message, created_at, processed_at')
        .eq('match_id', matchId);
        
    console.log("📊 Fila Oráculo-V:");
    console.log(queueData);
    
    const { data: insightsData, error: iErr } = await supabase.from('ai_insights')
        .select('player_id, created_at, model_used')
        .eq('match_id', matchId);
        
    console.log("\n💡 AI Insights Oráculo-V:");
    console.log(insightsData);
    
    const { data: ptcInsights, error: pErr } = await supabaseProtocol.from('ai_insights')
        .select('player_id, created_at, model_used')
        .eq('match_id', matchId);
        
    console.log("\n💡 AI Insights Protocolo-V:");
    console.log(ptcInsights);
}

checkMatch();
