import { supabase } from '../lib/supabase.js';

const MATCH_ID = 'ed99d061-40a6-410c-91d5-d4ca0d1f9117';

async function reset() {
    console.log(`🚀 [URGENT] Iniciando reset da partida: ${MATCH_ID}...`);

    // 1. Deletar insights existentes do Oráculo para essa partida (Apenas um existe, mas vamos limpar tudo por segurança)
    const { error: delErr } = await supabase
        .from('ai_insights')
        .delete()
        .eq('match_id', MATCH_ID);
    
    if (delErr) {
        console.error("❌ Erro ao deletar insights de Oráculo-V:", delErr.message);
    } else {
        console.log("🗑️ Insights de Oráculo-V removidos.");
    }

    // Nota: O Protocolo-V está mapeado para o mesmo endpoint ai_insights na maioria das vezes,
    // mas se for base separada e tiver sync, o worker cuidará de gerar novos.
    // Como a verificação mostrou 0 insights no Protocolo, não precisamos deletar lá.

    // 2. Marcar todos como 'pending' (Garante nova tentativa)
    const { error: upErr } = await supabase
        .from('match_analysis_queue')
        .update({ 
            status: 'pending',
            error_message: null,
            processed_at: null
        })
        .eq('match_id', MATCH_ID);

    if (upErr) {
        console.error("❌ Erro ao resetar a fila:", upErr.message);
    } else {
        console.log("✅ Fila de processamento resetada para 'pending'.");
    }

    console.log("\n💡 Inicie o worker agora para processar esta partida com prioridade.");
}

reset();
