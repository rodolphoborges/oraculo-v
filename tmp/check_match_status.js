import { supabase, supabaseProtocol } from '../lib/supabase.js';

const MATCH_ID = 'ed99d061-40a6-410c-91d5-d4ca0d1f9117';
const BANNED_TERMS = ['menear', 'pratele', 'alinharmos', 'instâncias', 'croixhair', 'punkts', 'energia', 'estímulos', 'initiativa', 'group', 'positioning', 'missions'];

function isLowQuality(insight) {
    if (!insight) return true;
    const insightText = typeof insight === 'string' ? insight : JSON.stringify(insight);
    if (/[^\x00-\x7F\u00C0-\u017F\s.,!?:;"'()\[\]\n\r]/.test(insightText)) return true;
    const lower = insightText.toLowerCase();
    const found = BANNED_TERMS.filter(term => lower.includes(term));
    return found.length > 0;
}

async function checkMatch() {
    console.log(`🔎 Verificando partida: ${MATCH_ID}\n`);

    // 1. Check Queues
    const { data: queueItems } = await supabase
        .from('match_analysis_queue')
        .select('*')
        .eq('match_id', MATCH_ID);
    
    console.log(`📋 Fila de Processamento: ${queueItems?.length || 0} itens.`);
    if (queueItems) {
        queueItems.forEach(q => console.log(`   - Player: ${q.agente_tag} | Status: ${q.status} | Erro: ${q.error_message || 'Nenhum'}`));
    }

    // 2. Check Insights (Oráculo-V)
    const { data: oraculoInsights } = await supabase
        .from('ai_insights')
        .select('*')
        .eq('match_id', MATCH_ID);
    
    console.log(`\n🧠 Insights (Oráculo-V): ${oraculoInsights?.length || 0} itens.`);
    if (oraculoInsights) {
        oraculoInsights.forEach(i => {
            const low = isLowQuality(i.insight_resumo);
            console.log(`   - Player: ${i.player_id} | Qualidade: ${low ? '❌ BAIXA' : '✅ BOA'}`);
            console.log(`     Insight: ${JSON.stringify(i.insight_resumo, null, 2)}`);
        });
    }

    // 3. Check Insights (Protocolo-V)
    if (supabaseProtocol) {
        const { data: protocolInsights } = await supabaseProtocol
            .from('ai_insights')
            .select('*')
            .eq('match_id', MATCH_ID);
        
        console.log(`\n📡 Insights (Protocolo-V): ${protocolInsights?.length || 0} itens.`);
        if (protocolInsights) {
            protocolInsights.forEach(i => {
                const low = isLowQuality(i.insight_resumo);
                console.log(`   - Player: ${i.player_id} | Qualidade: ${low ? '❌ BAIXA' : '✅ BOA'}`);
                if (low) console.log(`     Insight: ${JSON.stringify(i.insight_resumo)}`);
            });
        }
    }
}

checkMatch();
