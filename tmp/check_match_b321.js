import { supabase, supabaseProtocol } from '../lib/supabase.js';

const MATCH_ID = 'b321fc60-a15f-441d-8ba3-7ec0dc11fe0b';

async function checkMatchB321() {
    console.log(`🔎 Analisando partida: ${MATCH_ID}\n`);

    const { data: queue } = await supabase
        .from('match_analysis_queue')
        .select('agente_tag, status, error_message, metadata')
        .eq('match_id', MATCH_ID);

    const { data: oraculoInsights } = await supabase
        .from('ai_insights')
        .select('player_id, model_used, insight_resumo')
        .eq('match_id', MATCH_ID);

    const { data: protocoloInsights } = await supabaseProtocol
        .from('ai_insights')
        .select('player_id, model_used')
        .eq('match_id', MATCH_ID);

    console.log("📋 STATUS NA FILA:");
    queue.forEach(q => {
        const hasOraculo = oraculoInsights.find(i => i.player_id === q.agente_tag);
        const hasProtocolo = protocoloInsights.find(i => i.player_id === q.agente_tag);
        console.log(` - ${q.agente_tag.padEnd(20)} | Status: ${q.status.padEnd(10)} | Oráculo: ${hasOraculo ? '✅' : '❌'} | Protocolo: ${hasProtocolo ? '✅' : '❌'}`);
    });

    console.log("\n🧠 CONTEÚDO DOS INSIGHTS (ORÁCULO):");
    oraculoInsights.forEach(i => {
        console.log(`\n👤 Player: ${i.player_id}`);
        console.log(`🤖 Model: ${i.model_used}`);
        console.log(`📝 Resumo: ${i.insight_resumo.diagnostico_principal}`);
    });
}

checkMatchB321();
