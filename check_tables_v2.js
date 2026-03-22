import { supabase, supabaseProtocol, getSupabaseConfig } from './lib/supabase.js';

async function checkTables() {
    const config = getSupabaseConfig();
    
    console.log(`--- DIAGNÓSTICO MULTI-BASE ---`);
    console.log(`📡 Oráculo (Fila): ${config.oraculoUrl}`);
    console.log(`📡 Protocolo (Dados): ${config.protocolUrl}`);
    console.log(`-------------------------------`);

    // 1. Verificar Oráculo (Fila)
    console.log("\n[ORÁCULO] Verificando 'match_analysis_queue'...");
    const { data: mData, error: mError } = await supabase.from('match_analysis_queue').select('count').limit(1);
    if (mError) console.error("❌ Erro:", mError.message);
    else console.log("✅ match_analysis_queue existe!");

    // 2. Verificar Protocolo (Jogadores)
    console.log("\n[PROTOCOLO] Verificando 'players'...");
    const { data: pData, error: pError } = await supabaseProtocol.from('players').select('count', { count: 'exact', head: true });
    if (pError) console.error("❌ Erro:", pError.message);
    else console.log(`✅ players existe! (Total: ${pData || '?'})`);

    const { data: oData, error: oError } = await supabaseProtocol.from('operation_squads').select('count').limit(1);
    if (oError) console.error("[PROTOCOLO] Erro operation_squads:", oError.message);
    else console.log("[PROTOCOLO] ✅ operation_squads existe!");
}

checkTables();
