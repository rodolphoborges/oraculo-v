import { supabase } from '../lib/supabase.js';

async function sanitize() {
    console.log("🧹 [SANITIZE] Iniciando unificação de tags para ousadia#013 (com tratamento de duplicatas)...");
    
    // 1. Buscar registros em maiúsculo
    const { data: upper, error: err1 } = await supabase
        .from('match_analysis_queue')
        .select('id, match_id')
        .eq('agente_tag', 'OUSADIA#013');

    if (err1) {
        console.error("❌ Erro ao buscar registros OUSADIA#013:", err1.message);
        return;
    }

    if (!upper || upper.length === 0) {
        console.log("✅ Nenhum registro OUSADIA#013 encontrado.");
        return;
    }

    console.log(`🔍 Encontrados ${upper.length} registros OUSADIA#013.`);

    let updated = 0;
    let deleted = 0;

    for (const job of upper) {
        // Verificar se já existe a versão em minúsculo para esta mesma partida
        const { data: lower } = await supabase
            .from('match_analysis_queue')
            .select('id')
            .eq('match_id', job.match_id)
            .eq('agente_tag', 'ousadia#013')
            .single();

        if (lower) {
            // Se já existe minúsculo, deletamos o maiúsculo (duplicata de entrada)
            console.log(`🗑️ Deletando duplicata OUSADIA#013 para Match ${job.match_id} (Já existe minúsculo).`);
            const { error: delErr } = await supabase
                .from('match_analysis_queue')
                .delete()
                .eq('id', job.id);
            if (!delErr) deleted++;
        } else {
            // Se não existe, podemos atualizar com segurança
            console.log(`🔄 Atualizando OUSADIA#013 -> ousadia#013 para Match ${job.match_id}.`);
            const { error: upErr } = await supabase
                .from('match_analysis_queue')
                .update({ agente_tag: 'ousadia#013' })
                .eq('id', job.id);
            if (!upErr) updated++;
        }
    }

    console.log(`✅ Fim da sanitização: ${updated} atualizados, ${deleted} duplicatas removidas.`);
}

sanitize();
