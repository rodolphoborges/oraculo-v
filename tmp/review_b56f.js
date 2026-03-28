import { supabase } from '../lib/supabase.js';

async function reviewMatch() {
    const matchId = 'b56f4740-e11a-45d5-a966-6f58789ec616';
    const playerTag = 'm4sna#chama';

    console.log(`🔎 Revisando partida: ${matchId} (Player: ${playerTag})`);

    const { data: insights, error } = await supabase
        .from('ai_insights')
        .select('*')
        .eq('match_id', matchId)
        .eq('player_id', playerTag);

    if (error) {
        console.error('❌ Erro:', error.message);
        return;
    }

    if (!insights || insights.length === 0) {
        console.log('⚠️ Nenhum insight encontrado para esta combinação.');
        return;
    }

    insights.forEach((data, index) => {
        console.log(`✅ [INSIGHT #${index + 1}] (Created at: ${data.created_at})`);
        console.log(JSON.stringify(data.insight_resumo, null, 2));
    });
}

reviewMatch();
