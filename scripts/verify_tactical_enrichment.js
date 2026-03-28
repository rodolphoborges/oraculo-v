import { supabase, supabaseProtocol } from '../lib/supabase.js';

async function forceReprocess() {
    // 1. Breeze Match (DefeitoDeFábrica - Sage)
    const match1 = 'b321fc60-40a6-410c-91d5-d4ca0d1f9117';
    const player1 = 'DefeitoDeFábrica#ZzZ';

    // 2. Sage Entry Match (m4sna)
    const match2 = 'b56f4740-e11a-45d5-a966-6f58789ec616';
    const player2 = 'm4sna#chama';

    const targets = [
        { match_id: match1, player_id: player1 },
        { match_id: match2, player_id: player2 }
    ];

    for (const t of targets) {
        console.log(`🧹 Removendo insights antigos para ${t.match_id}...`);
        await supabase.from('ai_insights').delete().eq('match_id', t.match_id).eq('player_id', t.player_id);
        if (supabaseProtocol) {
            await supabaseProtocol.from('ai_insights').delete().eq('match_id', t.match_id).eq('player_id', t.player_id);
        }

        console.log(`📥 Enfileirando Job: ${t.player_id} na partida ${t.match_id}`);
        await supabase.from('match_analysis_queue').upsert([{
            match_id: t.match_id,
            agente_tag: t.player_id,
            status: 'pending',
            created_at: new Date().toISOString()
        }], { onConflict: 'match_id,agente_tag' });
    }

    console.log(`🚀 Jobs enfileirados. Verifique o Worker.`);
}

forceReprocess();
