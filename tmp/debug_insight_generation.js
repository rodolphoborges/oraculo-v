import { supabase } from '../lib/supabase.js';
import { generateInsights } from '../lib/openrouter_engine.js';
import { runAnalysis } from '../analyze_match.js';

async function testSingleMatch() {
    const matchId = 'ed99d061-40a6-410c-91d5-d4ca0d1f9117';
    const tag = 'ALEGRIA#021';

    console.log(`🚀 Reprocessando localmente ${tag} em ${matchId}`);

    // 1. Run Python engine
    const result = await runAnalysis(tag, matchId, 'ALL', 'ALL', {});
    if (result.error) {
        console.error("❌ Erro no runAnalysis:", result.error);
        return;
    }

    console.log("✅ Analysis Result base concluido.");

    // 2. Generate Insight
    const promptData = {
        match_data: {
            agent: result.agent, map: result.map,
            perf: result.performance_index,
            kd: result.kd, acs: result.acs,
            total_rounds: result.total_rounds,
            conselhosBase: result.all_conselhos
        },
        trend: "Teste Trend",
        history: null,
        squad: null
    };

    console.log("🤖 Tentando IA Insight...");
    const aiResponse = await generateInsights(promptData);

    if (aiResponse) {
        console.log("✅ AI INSIGHT GERADO! ->", aiResponse.insight);
        
        // Testa a gravação direta
        console.log("📡 Testando Insert em ai_insights...");
        const { error: insErr } = await supabase.from('ai_insights').insert([{
            match_id: matchId,
            player_id: tag,
            insight_resumo: aiResponse.insight,
            model_used: aiResponse.model_used
        }]);
        
        if (insErr) {
            console.error("❌ Erro DB ao inserir insight:", insErr.message);
        } else {
            console.log("✅ DB Insert SUCESSO.");
        }
    } else {
        console.error("❌ AI RESPONSE FOI NULL!");
    }
}

testSingleMatch();
