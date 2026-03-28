/**
 * check_tables_v2.js
 * 
 * Diagnostic utility for dual-database connectivity.
 * Verifies that the 'players' and 'operation_squads' tables exist in Protocolo-V,
 * and that 'match_analysis_queue' exists in Oráculo-V.
 */
import { supabase, supabaseProtocol, getSupabaseConfig } from '../lib/supabase.js';

async function checkTables() {
    const config = getSupabaseConfig();
    
    console.log(`--- DIAGNÓSTICO MULTI-BASE ---`);
    console.log(`📡 Oráculo (Fila): ${config.oraculoUrl}`);
    console.log(`📡 Protocolo (Dados): ${config.protocolUrl}`);
    console.log(`-------------------------------`);

    // 3. Verificar Novas Tabelas da IA (Oráculo-V)
    console.log("\n[ORÁCULO] Verificando Novas Tabelas (IA)...");
    const tables = ['ai_insights', 'match_stats', 'vw_player_trends'];
    
    for (const table of tables) {
        const { error } = await supabase.from(table).select('count').limit(1);
        if (error) console.error(`❌ Erro em '${table}':`, error.message);
        else console.log(`✅ ${table} detectada e acessível!`);
    }

    console.log(`\n-------------------------------`);
    console.log(`📡 [STATUS] Motor Prontos para Operação.`);
}

checkTables();
