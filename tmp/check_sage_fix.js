import { supabase } from '../lib/supabase.js';

async function checkInsight() {
    const matchId = 'b56f4740-e11a-45d5-a966-6f58789ec616';
    const playerTag = 'm4sna#chama';

    const { data, error } = await supabase
        .from('ai_insights')
        .select('*')
        .eq('match_id', matchId)
        .eq('player_id', playerTag)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error) {
        console.error('❌ Erro:', error.message);
        return;
    }

    console.log('✅ INSIGHT GERADO:');
    console.log(JSON.stringify(data.insight_resumo, null, 2));
}

checkInsight();
