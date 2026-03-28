/**
 * scripts/force_sync_insights.js
 * 
 * Este script faz um varredura na base primária do Oráculo-V e espelha 
 * TODO o histórico da tabela `ai_insights` para o banco do Protocolo-V.
 * Resolve partidas "órfãs" geradas antes da arquitetura de Double-Write entrar no ar.
 */
import { supabase, supabaseProtocol } from '../lib/supabase.js';

async function syncAllInsights() {
    console.log("🚀 [SYNC] Iniciando Migração Dual-Base (Oráculo -> Protocolo-V)...");

    if (!supabaseProtocol) {
        console.error("❌ ERRO: A conexão com o Supabase do Protocolo-V não está configurada.");
        return;
    }

    // 1. Buscar todos os insights da Base Mestre (Oráculo)
    const { data: oraculoData, error: oErr } = await supabase.from('ai_insights').select('*');
    if (oErr) {
        console.error("❌ Erro ao ler base primária:", oErr.message);
        return;
    }

    console.log(`🔍 [SCAN] Encontrados ${oraculoData.length} laudos na base local.`);

    // 2. Extrair todas as chaves únicas (partida + jogador) que já existem no Protocolo-V
    const { data: protoData, error: pErr } = await supabaseProtocol.from('ai_insights').select('player_id, match_id');
    if (pErr) {
        console.error("❌ Erro ao ler base espelho (Protocolo-V):", pErr.message);
        return;
    }

    const protoSet = new Set(protoData.map(i => `${i.player_id}_${i.match_id}`));

    // 3. Filtrar apenas o que falta (Os Órfãos)
    const pendingSync = oraculoData.filter(i => !protoSet.has(`${i.player_id}_${i.match_id}`));

    console.log(`🎯 [TARGET] Identificados ${pendingSync.length} laudos órfãos que precisam ser espelhados.`);

    if (pendingSync.length === 0) {
        console.log("✅ As bases já estão perfeitamente sincronizadas!");
        return;
    }

    // 4. Inserção Lote no Protocolo-V (Não podemos usar "upsert" sem onConflict claro, então usamos insert filtrado)
    const chunkSize = 100;
    let syncedCount = 0;

    for (let i = 0; i < pendingSync.length; i += chunkSize) {
        // Removendo a coluna "id" (PK) e "created_at" para que o banco de destino crie seus próprios ou insira limpo.
        // Opcional: Se as chaves primárias e horários precisam bater 1:1, mantemos as originais. Vamos manter para histórico puro.
        const chunk = pendingSync.slice(i, i + chunkSize);
        
        console.log(`📡 [MIGRATION] Injetando lote de ${chunk.length} laudos no Protocolo-V...`);
        const { error: insErr } = await supabaseProtocol.from('ai_insights').upsert(chunk, { onConflict: 'id' });

        if (insErr) {
            console.error(`❌ Falha no lote: ${insErr.message}`);
        } else {
            syncedCount += chunk.length;
        }
    }

    console.log(`\n🏆 [OPERAÇÃO CONCLUÍDA]`);
    console.log(`✅ ${syncedCount} partidas espelhadas com sucesso para o Frontend!`);
}

syncAllInsights();
