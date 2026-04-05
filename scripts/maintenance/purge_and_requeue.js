import { supabase, supabaseProtocol } from './lib/supabase.js';

const BANNED_TERMS = ['menear', 'pratele', 'alinharmos', 'instâncias', 'croixhair', 'punkts', 'energia', 'estímulos', 'initiativa', 'group', 'positioning', 'missions'];

function isLowQuality(insight) {
    if (!insight) return true;
    const insightText = typeof insight === 'string' ? insight : JSON.stringify(insight);
    if (/[^\x00-\x7F\u00C0-\u017F\s.,!?:;"'()\[\]\n\r]/.test(insightText)) return true;
    const lower = insightText.toLowerCase();
    const found = BANNED_TERMS.filter(term => lower.includes(term));
    return found.length > 0;
}

async function purgeAndRequeue() {
    console.log("🛠️ [PURGE] Iniciando limpeza de insights de baixa qualidade...");

    // 1. Coletar dados de Oráculo-V
    const { data: oraculoInsights } = await supabase.from('ai_insights').select('*');
    const badOraculo = oraculoInsights.filter(i => isLowQuality(i.insight_resumo));

    // 2. Coletar dados de Protocolo-V
    let badProtocol = [];
    if (supabaseProtocol) {
        const { data: protocolInsights } = await supabaseProtocol.from('ai_insights').select('*');
        badProtocol = protocolInsights.filter(i => isLowQuality(i.insight_resumo));
    }

    const uniqueToRequeue = new Map(); // key: match_id|player_id, value: metadata

    // 3. Deletar e marcar para re-enfileiramento (Oráculo)
    for (const insight of badOraculo) {
        console.log(`🗑️ Deletando de Oráculo-V: ID ${insight.id} (Match ${insight.match_id})`);
        await supabase.from('ai_insights').delete().eq('id', insight.id);
        uniqueToRequeue.set(`${insight.match_id}|${insight.player_id}`, { match_id: insight.match_id, player_id: insight.player_id });
    }

    // 4. Deletar (Protocolo)
    if (supabaseProtocol) {
        for (const insight of badProtocol) {
            console.log(`🗑️ Deletando de Protocolo-V: ID ${insight.id} (Match ${insight.match_id})`);
            await supabaseProtocol.from('ai_insights').delete().eq('id', insight.id);
            uniqueToRequeue.set(`${insight.match_id}|${insight.player_id}`, { match_id: insight.match_id, player_id: insight.player_id });
        }
    }

    // 5. Re-enfileirar
    console.log(`♻️ Re-enfileirando ${uniqueToRequeue.size} partidas...`);
    for (const [key, data] of uniqueToRequeue) {
        console.log(`🚀 [QUEUE] ${data.player_id} na partida ${data.match_id}`);
        await supabase.from('match_analysis_queue').upsert([{
            match_id: data.match_id,
            agente_tag: data.player_id,
            status: 'pending',
            error_message: null
        }], { onConflict: 'match_id,agente_tag' });
    }

    console.log("✅ Processo concluído. Inicie o worker para processar os novos insights.");
}

purgeAndRequeue();
