import { supabase, supabaseProtocol } from '../lib/supabase.js';
import { generateInsights } from '../lib/openrouter_engine.js';

async function backfill() {
    console.log("🚀 [BACKFILL-AI] Iniciando recuperação de insights perdidos...");

    // 1. Buscar todos os jobs 'completed'
    const { data: queueItems, error: qErr } = await supabase
        .from('match_analysis_queue')
        .select('*')
        .eq('status', 'completed');

    if (qErr) {
        console.error("❌ Erro ao ler fila:", qErr.message);
        return;
    }

    // 2. Buscar todos os insights existentes (Oráculo)
    const { data: aiInsights, error: aiErr } = await supabase
        .from('ai_insights')
        .select('player_id, match_id');

    if (aiErr) {
        console.error("❌ Erro ao ler insights de IA:", aiErr.message);
        return;
    }

    const readySet = new Set(aiInsights.map(i => `${i.player_id.toUpperCase()}_${i.match_id}`));

    // 3. Filtrar os que não possuem insight
    const missing = queueItems.filter(item => {
        const key = `${item.agente_tag.toUpperCase()}_${item.match_id}`;
        return !readySet.has(key);
    });

    console.log(`🎯 Identificados ${missing.length} jobs aguardando geração de IA.`);

    if (missing.length === 0) {
        console.log("✅ Tudo em dia!");
        return;
    }

    for (const job of missing) {
        console.log(`\n👷 Processando: ${job.agente_tag} em ${job.match_id}`);
        
        const result = job.metadata?.analysis;
        if (!result) {
            console.warn(`⚠️ Pula: Job ${job.id} não possui metadados de análise.`);
            continue;
        }

        // Buscar tendências e histórico (mesma lógica do worker)
        let trendData = "Histórico insuficiente";
        let previousInsights = null;
        try {
            const { data: trend } = await supabase
                .from('vw_player_trends')
                .select('*')
                .eq('player_id', job.agente_tag)
                .single();
            if (trend) trendData = trend;

            const { data: pastInsights } = await supabase
                .from('ai_insights')
                .select('insight_resumo')
                .eq('player_id', job.agente_tag)
                .order('created_at', { ascending: false })
                .limit(2);
            if (pastInsights) previousInsights = pastInsights.map(i => i.insight_resumo);
        } catch (e) {}

        const promptData = {
            match_data: {
                agent: result.agent, map: result.map,
                perf: result.performance_index,
                kd: result.kd, acs: result.acs,
                total_rounds: result.total_rounds,
                conselhosBase: result.all_conselhos
            },
            trend: trendData,
            history: previousInsights,
            squad: null
        };

        const aiResponse = await generateInsights(promptData);
        if (aiResponse) {
            console.log(`✅ Insight gerado via ${aiResponse.model_used}`);
            
            // Inserir no Oráculo
            await supabase.from('ai_insights').insert([{
                match_id: job.match_id,
                player_id: job.agente_tag,
                insight_resumo: aiResponse.insight,
                model_used: aiResponse.model_used
            }]);

            // Sincronizar com Protocolo-V
            if (supabaseProtocol) {
                const { error: syncErr } = await supabaseProtocol.from('ai_insights').insert([{
                    match_id: job.match_id,
                    player_id: job.agente_tag,
                    insight_resumo: aiResponse.insight,
                    model_used: aiResponse.model_used
                }]);
                if (!syncErr) console.log("📡 Sincronizado com Protocolo-V.");
            }
            
            // Marcar no próprio metadata que foi gerado via backfill
            await supabase.from('match_analysis_queue').update({
                metadata: { ...job.metadata, ai_generated: true, backfilled_at: new Date().toISOString() }
            }).eq('id', job.id);

        } else {
            console.warn("❌ Falha na geração de IA para este item.");
        }

        // Espera um pouco para não estressar os modelos free/local
        await new Promise(r => setTimeout(r, 2000));
    }

    console.log("\n🏁 Backfill finalizado.");
}

backfill();
