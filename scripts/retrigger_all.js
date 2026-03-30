import { supabase } from '../lib/supabase.js';

async function retriggerAll() {
    console.log("♻️ [RETRIGGER] Iniciando re-enfileiramento de todas as partidas analisadas...");

    // 1. Buscar todos os registros em ai_insights (Oráculo-V)
    // Usamos o Oráculo-V como fonte de mídias/insights locais
    const { data: insights, error: fetchError } = await supabase
        .from('ai_insights')
        .select('match_id, player_id');

    if (fetchError) {
        console.error("❌ Erro ao buscar insights:", fetchError.message);
        process.exit(1);
    }

    if (!insights || insights.length === 0) {
        console.log("ℹ️ Nenhuma partida encontrada para re-enfileirar.");
        process.exit(0);
    }

    console.log(`🔍 Encontradas ${insights.length} análises existentes.`);

    // 2. Adicionar cada par match_id/player_id na fila de análise
    let count = 0;
    for (const insight of insights) {
        process.stdout.write(`🚀 [QUEUE] ${insight.player_id} na partida ${insight.match_id}... `);
        
        const { error: upsertError } = await supabase
            .from('match_analysis_queue')
            .upsert([{
                match_id: insight.match_id,
                agente_tag: insight.player_id,
                status: 'pending',
                error_message: null,
                created_at: new Date().toISOString()
            }], { 
                onConflict: 'match_id, agente_tag' 
            });

        if (upsertError) {
            console.log(`❌ Falha: ${upsertError.message}`);
        } else {
            console.log("✅ OK");
            count++;
        }
        // Pequeno delay para evitar overload
        await new Promise(r => setTimeout(r, 100));
    }

    console.log(`\n✨ Concluído! ${count} partidas re-enfileiradas com sucesso.`);
    console.log("📡 Certifique-se de que o 'worker.js' está rodando para processar os itens.");
    process.exit(0);
}

retriggerAll();
