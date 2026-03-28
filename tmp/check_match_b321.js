import { supabase, supabaseProtocol } from '../lib/supabase.js';

async function checkMatch() {
    const matchId = 'b321fc60-a15f-441d-8ba3-7ec0dc11fe0b';
    console.log(`🔍 [DEBUG] Verificando match: ${matchId}`);

    const { data: queueData } = await supabase.from('match_analysis_queue')
        .select('agente_tag, status, error_message, created_at, processed_at')
        .eq('match_id', matchId);
        
    console.log("📊 Fila Oráculo-V:");
    console.log(queueData);
    
    const { data: insightsData } = await supabase.from('ai_insights')
        .select('player_id, created_at, model_used')
        .eq('match_id', matchId);
        
    console.log("\n💡 AI Insights Oráculo-V:");
    console.log(insightsData);
    
    const { data: ptcInsights } = await supabaseProtocol.from('ai_insights')
        .select('player_id, created_at, model_used')
        .eq('match_id', matchId);
        
    console.log("\n💡 AI Insights Protocolo-V:");
    console.log(ptcInsights);
}

checkMatch();
