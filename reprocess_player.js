import { supabase, supabaseProtocol } from './lib/supabase.js';

/**
 * reprocess_player.js
 * 
 * Reseta o estado de tendência (Holt-Winters) de um jogador e 
 * re-enfileira todas as suas partidas para que o motor de análise 
 * as processe novamente em ordem cronológica.
 */

const playerTag = process.argv[2];

if (!playerTag) {
    console.error("❌ Uso: node reprocess_player.js \"PLAYER#TAG\" ou \"ALL\"");
    process.exit(1);
}

async function run() {
    const isAll = playerTag.toUpperCase() === 'ALL';
    console.log(`🚀 [REPROCESS] Iniciando reset para: ${isAll ? 'TODOS OS JOGADORES' : playerTag}`);

    // 1. Resetar o estado Holt no Protocolo-V
    console.log(`📉 [1/3] Resetando tendência no(s) perfil(is)...`);
    const playerQuery = supabaseProtocol.from('players').update({
        performance_l: null,
        performance_t: null,
        kd_l: null,
        kd_t: null,
        adr_l: null,
        adr_t: null
    });

    if (!isAll) {
        playerQuery.eq('riot_id', playerTag);
    } else {
        // Filtro dummy para permitir update global (Supabase safety)
        playerQuery.neq('riot_id', '');
    }

    const { error: pError } = await playerQuery;

    if (pError) {
        console.error("❌ Erro ao resetar jogador(es):", pError.message);
        return;
    }
    console.log(`✅ Perfil(is) resetado(s).`);

    // 2. Re-enfileirar as partidas no Oráculo-V
    console.log(`🔄 [2/3] Re-enfileirando partidas completadas/falhas...`);
    
    const queueQuery = supabase
        .from('match_analysis_queue')
        .update({
            status: 'pending',
            error_message: null,
            processed_at: null,
        })
        .in('status', ['completed', 'failed']);

    if (!isAll) queueQuery.eq('agente_tag', playerTag);

    const { count, error: qError } = await queueQuery.select('*', { count: 'exact', head: true });

    if (qError) {
        console.error("❌ Erro ao re-enfileirar partidas:", qError.message);
        return;
    }

    console.log(`✅ ${count} partidas voltaram para o estado 'pending'.`);

    // 3. Instruções finais
    console.log(`\n✨ [SUCESSO] O processo foi reiniciado.`);
    console.log(`👷 O Worker (worker.js) agora processará todas as partidas na ordem original.`);
}

run();
