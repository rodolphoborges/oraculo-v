import { supabase, supabaseProtocol } from '../lib/supabase.js';

async function backfill() {
    console.log("🚀 [BACKFILL] Iniciando recalibragem de tendências para todos os jogadores...");

    // 1. Pegar todos os jogadores
    const { data: players, error: pError } = await supabaseProtocol.from('players').select('riot_id');
    if (pError) {
        console.error("❌ Erro ao buscar jogadores:", pError.message);
        return;
    }

    console.log(`👥 Encontrados ${players.length} jogadores. Processando histórico...`);

    const alpha = 0.4;
    const beta = 0.2;

    for (const player of players) {
        const tag = player.riot_id;
        
        // 2. Buscar todas as análises completas deste jogador (em ordem cronológica)
        const { data: matches, error: mError } = await supabase
            .from('match_analysis_queue')
            .select('metadata->perf, metadata->analysis->kd, metadata->analysis->adr')
            .eq('agente_tag', tag)
            .eq('status', 'completed')
            .order('created_at', { ascending: true });

        if (mError) {
            console.error(`❌ Erro ao buscar partidas para ${tag}:`, mError.message);
            continue;
        }

        if (!matches || matches.length < 3) {
            console.log(`⚠️  ${tag}: Partidas insuficientes (< 3) para gerar tendência.`);
            continue;
        }

        // 3. Inicializar com as 3 primeiras
        const m0 = matches[0];
        const m1 = matches[1];
        const m2 = matches[2];

        // L0 = média das 3
        let L_perf = (m0.perf + m1.perf + m2.perf) / 3;
        let L_kd = (m0.kd + m1.kd + m2.kd) / 3;
        let L_adr = (m0.adr + m1.adr + m2.adr) / 3;

        // T0 = média das diferenças
        let T_perf = ((m1.perf - m0.perf) + (m2.perf - m1.perf)) / 2;
        let T_kd = ((m1.kd - m0.kd) + (m2.kd - m1.kd)) / 2;
        let T_adr = ((m1.adr - m0.adr) + (m2.adr - m1.adr)) / 2;

        // 4. Holt incremental para a partida 4 em diante
        if (matches.length > 3) {
            for (let i = 3; i < matches.length; i++) {
                const mt = matches[i];
                
                // Holt Formulas
                const old_L_perf = L_perf;
                L_perf = alpha * mt.perf + (1 - alpha) * (L_perf + T_perf);
                T_perf = beta * (L_perf - old_L_perf) + (1 - beta) * T_perf;

                const old_L_kd = L_kd;
                L_kd = alpha * mt.kd + (1 - alpha) * (L_kd + T_kd);
                T_kd = beta * (L_kd - old_L_kd) + (1 - beta) * T_kd;

                const old_L_adr = L_adr;
                L_adr = alpha * mt.adr + (1 - alpha) * (L_adr + T_adr);
                T_adr = beta * (L_adr - old_L_adr) + (1 - beta) * T_adr;
            }
        }

        // 5. Salvar estado final no Perfil do Jogador
        const { error: upError } = await supabaseProtocol.from('players').update({
            performance_l: L_perf, performance_t: T_perf,
            kd_l: L_kd, kd_t: T_kd,
            adr_l: L_adr, adr_t: T_adr
        }).eq('riot_id', tag);

        if (upError) {
            console.error(`❌ Erro ao atualizar ${tag}:`, upError.message);
        } else {
            console.log(`✅ ${tag}: Tendência (Holt) calculada com base em ${matches.length} partidas.`);
        }
    }

    console.log("\n✨ [BACKFILL] Processo concluído com sucesso!");
}

backfill();
