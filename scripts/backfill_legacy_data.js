import { supabase, supabaseProtocol } from '../lib/supabase.js';

async function backfill() {
    console.log("🚀 Iniciando Backfill Cross-Database: Protocolo-V (Queue) -> Oráculo-V (Stats)");

    if (!supabaseProtocol) {
        console.error("❌ Cliente do Protocolo-V não inicializado. Verifique as chaves no .env.");
        process.exit(1);
    }

    // 1. Buscar registros completados na fila antiga (Protocolo-V)
    const { data: queue, error: qErr } = await supabaseProtocol
        .from('match_analysis_queue')
        .select('*')
        .eq('status', 'completed');

    if (qErr) {
        console.error("❌ Falha ao ler match_analysis_queue no Protocolo-V:", qErr.message);
        process.exit(1);
    }

    console.log(`📦 Encontrados ${queue.length} registros para migração.`);

    for (const job of queue) {
        const meta = job.metadata || {};
        const analysis = meta.analysis || {};

        // Mapeamento para a nova estrutura match_stats (Oráculo-V)
        const statsRow = {
            match_id: job.match_id,
            player_id: job.player_tag || meta.player_id, // Usamos player_tag da fila
            agent: meta.agent || 'Unknown',
            kills: analysis.kills || 0,
            deaths: analysis.deaths || 0,
            acs: analysis.acs || 0,
            adr: analysis.adr || 0,
            kast: analysis.kast || null,
            impact_score: meta.perf || 0,
            is_win: analysis.is_win || false,
            created_at: job.created_at
        };

        const { error: insErr } = await supabase
            .from('match_stats')
            .upsert([statsRow], { onConflict: 'match_id, player_id' });

        if (insErr) {
            console.log(`❌ Erro ao inserir no Oráculo/match_stats (Match: ${job.match_id}): ${insErr.message}`);
        } else {
            console.log(`✅ Migrado: ${statsRow.player_id} (Match: ${job.match_id})`);
        }
    }

    console.log("🏁 Processo de Backfill finalizado.");
}

backfill();
