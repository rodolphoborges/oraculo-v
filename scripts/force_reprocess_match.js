import { supabase, supabaseProtocol } from '../lib/supabase.js';

const matchId = process.argv[2];

if (!matchId) {
    console.error("❌ Uso: node scripts/force_reprocess_match.js MATCH_ID");
    process.exit(1);
}

async function run() {
    console.log(`\n🧹 [FORCE-RESET] Limpando dados da partida: ${matchId}`);

    // 1. Deletar insights existentes (Oráculo)
    const { error: oErr } = await supabase.from('ai_insights').delete().eq('match_id', matchId);
    if (oErr) console.warn("⚠️ Erro ao deletar insights no Oráculo:", oErr.message);
    else console.log("✅ Insights removidos do Oráculo-V.");

    // 2. Deletar insights existentes (Protocolo)
    if (supabaseProtocol) {
        const { error: pErr } = await supabaseProtocol.from('ai_insights').delete().eq('match_id', matchId);
        if (pErr) console.warn("⚠️ Erro ao deletar insights no Protocolo-V:", pErr.message);
        else console.log("✅ Insights removidos do Protocolo-V (Dashboard).");
    }

    // 3. Resetar fila para 'pending'
    const { error: qErr } = await supabase
        .from('match_analysis_queue')
        .update({ 
            status: 'pending', 
            error_message: null, 
            processed_at: null 
        })
        .eq('match_id', matchId);

    if (qErr) {
        console.error("❌ Erro ao resetar fila:", qErr.message);
    } else {
        console.log(`🚀 Partida ${matchId} voltou para o estado 'pending'.`);
        console.log("👷 O Worker irá processar agora com as novas diretrizes de elite!");
    }
}

run();
