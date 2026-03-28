import { supabase, supabaseProtocol } from './lib/supabase.js';

async function forceReprocess() {
    const matchId = 'b321fc60-40a6-410c-91d5-d4ca0d1f9117';
    const playerTag = 'DefeitoDeFábrica#ZzZ';

    console.log(`🧹 Removendo insights antigos para ${matchId}...`);
    
    // Remove from both DBs
    await supabase.from('ai_insights').delete().eq('match_id', matchId).eq('player_id', playerTag);
    if (supabaseProtocol) {
        await supabaseProtocol.from('ai_insights').delete().eq('match_id', matchId).eq('player_id', playerTag);
    }

    console.log(`📥 Enfileirando Job de Reprocessamento...`);
    await supabase.from('match_analysis_queue').upsert([{
        match_id: matchId,
        agente_tag: playerTag,
        status: 'pending',
        created_at: new Date().toISOString()
    }], { onConflict: 'match_id,agente_tag' });

    console.log(`🚀 Job enfileirado. O Worker deve processar em breve.`);
}

forceReprocess();
