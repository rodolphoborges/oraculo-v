import { supabase, supabaseProtocol } from './lib/supabase.js';

async function eliteBackfill() {
    console.log("🚀 [ELITE BACKFILL] Recalibrando HISTÓRICO COMPLETO de tendências...");

    const { data: players, error: pError } = await supabaseProtocol.from('players').select('riot_id');
    if (pError) {
        console.error("❌ Erro ao buscar jogadores:", pError.message);
        return;
    }

    const alpha = 0.4;
    const beta = 0.2;

    for (const player of players) {
        const tag = player.riot_id;
        
        const { data: matches, error: mError } = await supabase
            .from('match_analysis_queue')
            .select('id, metadata->perf, metadata->analysis->kd, metadata->analysis->adr, metadata')
            .eq('agente_tag', tag)
            .eq('status', 'completed')
            .order('created_at', { ascending: true });

        if (mError || !matches || matches.length < 3) continue;

        console.log(`📊 Processando ${matches.length} partidas para ${tag}...`);

        // Inicialização
        const m0 = matches[0];
        const m1 = matches[1];
        const m2 = matches[2];

        let L_perf = (m0.perf + m1.perf + m2.perf) / 3;
        let L_kd = (m0.kd + m1.kd + m2.kd) / 3;
        let L_adr = (m0.adr + m1.adr + m2.adr) / 3;

        let T_perf = ((m1.perf - m0.perf) + (m2.perf - m1.perf)) / 2;
        let T_kd = ((m1.kd - m0.kd) + (m2.kd - m1.kd)) / 2;
        let T_adr = ((m1.adr - m0.adr) + (m2.adr - m1.adr)) / 2;

        // Note: As 3 primeiras ficam com holt null ou inicial (opcional: salvar inicial nelas)

        for (let i = 3; i < matches.length; i++) {
            const mt = matches[i];
            
            // Holt Formulas
            const old_L_perf = L_perf;
            const old_L_kd = L_kd;
            const old_L_adr = L_adr;

            L_perf = alpha * mt.perf + (1 - alpha) * (L_perf + T_perf);
            T_perf = beta * (L_perf - old_L_perf) + (1 - beta) * T_perf;

            L_kd = alpha * mt.kd + (1 - alpha) * (L_kd + T_kd);
            T_kd = beta * (L_kd - old_L_kd) + (1 - beta) * T_kd;

            L_adr = alpha * mt.adr + (1 - alpha) * (L_adr + T_adr);
            T_adr = beta * (L_adr - old_L_adr) + (1 - beta) * T_adr;

            const holtState = {
                performance_l: L_perf, performance_t: T_perf, performance_forecast: L_perf + T_perf,
                kd_l: L_kd, kd_t: T_kd,
                adr_l: L_adr, adr_t: T_adr
            };

            // Atualizar o registro da partida individual
            const updatedMetadata = { 
                ...mt.metadata, 
                holt: holtState,
                analysis: { ...mt.metadata.analysis, holt: holtState }
            };

            await supabase
                .from('match_analysis_queue')
                .update({ metadata: updatedMetadata })
                .eq('id', mt.id);
        }

        // Salvar estado final no Perfil
        await supabaseProtocol.from('players').update({
            performance_l: L_perf, performance_t: T_perf,
            kd_l: L_kd, kd_t: T_kd,
            adr_l: L_adr, adr_t: T_adr
        }).eq('riot_id', tag);
    }

    console.log("✨ [ELITE BACKFILL] Histórico totalmente recalibrado.");
}

eliteBackfill();
