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
    console.error("❌ Uso: node reprocess_player.js \"PLAYER#TAG\"");
    process.exit(1);
}

async function run() {
    console.log(`🚀 [REPROCESS] Iniciando reset para o jogador: ${playerTag}`);

    // 1. Resetar o estado Holt no Protocolo-V
    console.log(`📉 [1/3] Resetando tendência no perfil do jogador...`);
    const { error: pError } = await supabaseProtocol
        .from('players')
        .update({
            performance_l: null,
            performance_t: null,
            kd_l: null,
            kd_t: null,
            adr_l: null,
            adr_t: null
        })
        .eq('riot_id', playerTag);

    if (pError) {
        console.error("❌ Erro ao resetar jogador:", pError.message);
        return;
    }
    console.log(`✅ Perfil resetado.`);

    // 2. Re-enfileirar as partidas no Oráculo-V
    console.log(`🔄 [2/3] Re-enfileirando partidas completadas/falhas...`);
    
    // Primeiro limpamos a metadata de análise anterior para garantir uma nova geração limpa
    // mas mantemos informações essenciais como chat_id
    const { count, error: qError } = await supabase
        .from('match_analysis_queue')
        .update({
            status: 'pending',
            error_message: null,
            processed_at: null,
            // Mantemos o metadata original mas garantimos que 'analysis' e 'holt' serão sobrescritos
        })
        .eq('agente_tag', playerTag)
        .in('status', ['completed', 'failed']);

    if (qError) {
        console.error("❌ Erro ao re-enfileirar partidas:", qError.message);
        return;
    }

    console.log(`✅ ${count} partidas voltaram para o estado 'pending'.`);

    // 3. Instruções finais
    console.log(`\n✨ [SUCESSO] O processo foi reiniciado para ${playerTag}.`);
    console.log(`👷 O Worker (worker.js) agora processará estas partidas na ordem original.`);
    console.log(`📈 Como o Holt-Winters é sequencial, a tendência será recalculada degrau por degrau.`);
}

run();
