import { supabase, supabaseProtocol } from './lib/supabase.js';

/**
 * sanitize_ids.js
 * 
 * 1. Remove espaços ao redor do '#' na tabela 'players' (Protocolo-V).
 * 2. Remove espaços ao redor do '#' na tabela 'match_analysis_queue' (Oráculo-V).
 * 3. Reseta jobs 'failed' para 'pending'.
 */

async function sanitize() {
    console.log("🧼 [SANITIZATION] Iniciando limpeza de IDs...");

    // 1. Sanitizar tabela 'players'
    const { data: players, error: pError } = await supabaseProtocol.from('players').select('riot_id');
    if (pError) console.error("❌ Erro ao buscar players:", pError.message);
    else {
        for (const p of players) {
            if (p.riot_id.includes(' #') || p.riot_id.includes('# ')) {
                const cleanId = p.riot_id.split('#').map(s => s.trim()).join('#');
                console.log(`✨ Corrigindo Player: ${p.riot_id} -> ${cleanId}`);
                await supabaseProtocol.from('players').update({ riot_id: cleanId }).eq('riot_id', p.riot_id);
            }
        }
    }

    // 2. Sanitizar tabela 'match_analysis_queue'
    const { data: queue, error: qError } = await supabase.from('match_analysis_queue').select('id, agente_tag, player_riot_id');
    if (qError) console.error("❌ Erro ao buscar fila:", qError.message);
    else {
        for (const q of queue) {
            let update = {};
            if (q.agente_tag && (q.agente_tag.includes(' #') || q.agente_tag.includes('# '))) {
                update.agente_tag = q.agente_tag.split('#').map(s => s.trim()).join('#');
            }
            if (q.player_riot_id && (q.player_riot_id.includes(' #') || q.player_riot_id.includes('# '))) {
                update.player_riot_id = q.player_riot_id.split('#').map(s => s.trim()).join('#');
            }

            if (Object.keys(update).length > 0) {
                console.log(`✨ Corrigindo Job ${q.id}: ${JSON.stringify(update)}`);
                await supabase.from('match_analysis_queue').update(update).eq('id', q.id);
            }
        }
    }

    // 3. Resetar Falhas
    console.log("🔄 Resetando jobs 'failed' para 'pending'...");
    const { count, error: resError } = await supabase
        .from('match_analysis_queue')
        .update({ status: 'pending', error_message: null, processed_at: null })
        .eq('status', 'failed');
    
    if (resError) console.error("❌ Erro ao resetar falhas:", resError.message);
    else console.log(`🚀 SUCESSO! Sanitização concluída e jobs resetados.`);
}

sanitize();
