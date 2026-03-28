/**
 * scripts/reprocess_completed_no_ai.js
 * 
 * Oráculo-V v4.0 - Reprocessador de Fila.
 * Identifica jobs marcados como 'completed' mas que não possuem registro 
 * na tabela 'ai_insights'. Altera o status para 'pending' para que o 
 * novo worker com suporte a OpenRouter/Ollama possa processá-los.
 */
import { supabase } from '../lib/supabase.js';

async function reprocess() {
    console.log("🔄 [RESET] Iniciando varredura de itens concluídos sem IA...");

    // 1. Buscar todos os itens concluídos na fila
    const { data: queueItems, error: qErr } = await supabase
        .from('match_analysis_queue')
        .select('id, agente_tag, match_id')
        .eq('status', 'completed');

    if (qErr) {
        console.error("❌ Erro ao ler fila:", qErr.message);
        return;
    }

    console.log(`🔍 Encontrados ${queueItems.length} jobs com status 'completed'.`);

    // 2. Buscar todos os insights de IA já geradores
    const { data: aiInsights, error: aiErr } = await supabase
        .from('ai_insights')
        .select('player_id, match_id');

    if (aiErr) {
        console.error("❌ Erro ao ler insights de IA:", aiErr.message);
        return;
    }

    // Criar um Set para busca rápida: "player_id_match_id"
    const readySet = new Set(aiInsights.map(i => `${i.player_id.toUpperCase()}_${i.match_id}`));

    // 3. Filtrar os que PRECISAM de reprocessamento (estão na fila como concluídos, mas não tem AI insight)
    const jobsToReset = queueItems.filter(item => {
        const key = `${item.agente_tag.toUpperCase()}_${item.match_id}`;
        return !readySet.has(key);
    });

    console.log(`🎯 Identificados ${jobsToReset.length} jobs que precisam de nova análise de IA.`);

    if (jobsToReset.length === 0) {
        console.log("✅ Toda a fila concluída já possui insights de IA. Nada a fazer.");
        return;
    }

    // 4. Resetar status para 'pending'
    const idsToReset = jobsToReset.map(j => j.id);
    const chunkSize = 100;
    let totalUpdated = 0;

    for (let i = 0; i < idsToReset.length; i += chunkSize) {
        const chunk = idsToReset.slice(i, i + chunkSize);
        console.log(`📡 [RESET] Voltando bloco de ${chunk.length} para 'pending'...`);
        
        const { error: updErr } = await supabase
            .from('match_analysis_queue')
            .update({ status: 'pending', error_message: null })
            .in('id', chunk);

        if (updErr) {
            console.error("❌ Erro ao atualizar status:", updErr.message);
        } else {
            totalUpdated += chunk.length;
        }
    }

    console.log(`\n🏆 [SUCESSO] ${totalUpdated} itens voltaram para a fila.`);
    console.log(`🚀 Já pode rodar 'npm run worker' para processar o backfill com IA!`);
}

reprocess();
