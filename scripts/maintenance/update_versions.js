import { supabaseProtocol } from './lib/supabase.js';

/**
 * update_versions.js
 * 
 * Encontra todas as análises feitas em versões anteriores e as reenfileira
 * para processamento com a lógica e prompt mais recentes (v4.2.1).
 */
const CURRENT_V = '4.2.1';

async function sync() {
    console.log(`\n🔄 [UPGRADE] Iniciando verificação de versões...`);
    console.log(`🎯 Versão Alvo: v${CURRENT_V}`);

    // 1. Buscar registros que não estão na versão atual (ou não possuem versão)
    const { data: records, error } = await supabaseProtocol
        .from('ai_insights')
        .select('match_id, player_id, engine_version')
        .or(`engine_version.lt.${CURRENT_V},engine_version.is.null`);

    if (error) {
        console.error('❌ Erro ao consultar banco:', error.message);
        return;
    }

    if (!records || records.length === 0) {
        console.log("✅ Excelente! Todas as análises já estão na última versão.");
        return;
    }

    console.log(`📦 Encontradas ${records.length} análises desatualizadas.`);

    // 2. Enfileirar para reprocessamento
    let count = 0;
    for (const item of records) {
        const { error: queueErr } = await supabaseProtocol
            .from('match_analysis_queue')
            .upsert({
                match_id: item.match_id,
                player_tag: item.player_id,
                status: 'pending',
                created_at: new Date().toISOString()
            }, { onConflict: 'match_id, player_tag' });

        if (!queueErr) count++;
    }

    console.log(`🚀 Adicionadas ${count} partidas à fila de processamento.`);
    console.log(`⚙️  O Oráculo-V começará a atualizar os relatórios em breve.\n`);
}

sync();
