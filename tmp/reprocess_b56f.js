import { supabase, supabaseProtocol } from '../lib/supabase.js';

async function req() {
    const matchId = 'b56f4740-e11a-45d5-a966-6f58789ec616';
    console.log(`🧹 Removendo insights antigos para ${matchId}...`);
    
    // Deleta os antigos corrompidos
    await supabase.from('ai_insights').delete().eq('match_id', matchId);
    if (supabaseProtocol) {
        await supabaseProtocol.from('ai_insights').delete().eq('match_id', matchId);
    }
    
    // Relança na fila apenas os agentes
    console.log("📥 Enfileirando jogadores da referida partida...");
    await supabase.from('match_analysis_queue')
        .update({ status: 'pending', error_message: null, processed_at: null })
        .eq('match_id', matchId)
        .neq('agente_tag', 'AUTO');
        
    console.log("Feito! Pronto para rodar o worker.");
}
req();
