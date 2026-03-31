
import { supabase, supabaseProtocol } from './lib/supabase.js';

async function reprocessEverything() {
    console.log("🧹 [PURGE] Iniciando limpeza total para reprocessamento cronológico...");

    try {
        // 1. Coletar todas as partidas existentes para saber a ordem cronológica
        console.log("📊 [STATS] Coletando histórico de partidas do Oráculo-V...");
        const { data: allMatches, error: fetchErr } = await supabase
            .from('match_stats')
            .select('match_id, player_id, created_at')
            .order('created_at', { ascending: true });

        if (fetchErr) throw new Error(`Falha ao buscar match_stats: ${fetchErr.message}`);
        if (!allMatches || allMatches.length === 0) {
            console.warn("⚠️ Nenhuma partida encontrada para reprocessar.");
            return;
        }

        console.log(`✅ ${allMatches.length} registros de performance localizados.`);

        // 2. Limpeza das tabelas de Insights (Qualitativo)
        console.log("🗑️ [CLEANUP] Deletando Insights do Oráculo-V...");
        await supabase.from('ai_insights').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

        if (supabaseProtocol) {
            console.log("🗑️ [CLEANUP] Deletando Insights do Protocolo-V...");
            await supabaseProtocol.from('ai_insights').delete().neq('id', '00000000-0000-0000-0000-000000000000');

            console.log("🧠 [RESET] Zerando estados matemáticos (Holt-Winters) dos jogadores...");
            await supabaseProtocol.from('players').update({
                performance_l: null, performance_t: null,
                kd_l: null, kd_t: null,
                adr_l: null, adr_t: null
            }).neq('riot_id', 'SYSTEM'); // Reset all players
        }

        // 3. Limpeza da Fila Atual
        console.log("🧹 [QUEUE] Limpando fila de análise atual...");
        const queueClient = supabaseProtocol || supabase; // Tenta Protocolo primeiro, fallback Oráculo
        
        try {
            const { error: delQueueErr } = await queueClient.from('match_analysis_queue').delete().neq('match_id', '00000000-0000-0000-0000-000000000000');
            if (delQueueErr) console.warn("⚠️ Aviso na limpeza da fila (Protocolo):", delQueueErr.message);
        } catch (e) {
            console.warn("⚠️ Falha ao acessar fila no Protocolo, tentando Oráculo...");
            await supabase.from('match_analysis_queue').delete().neq('match_id', '00000000-0000-0000-0000-000000000000');
        }

        // 4. Re-enfileiramento Cronológico
        console.log(`♻️ [REQUEUE] Enfileirando ${allMatches.length} partidas na ordem correta...`);
        
        const activeQueueClient = (supabaseProtocol) ? supabaseProtocol : supabase;
        
        let successCount = 0;
        for (const match of allMatches) {
            // Tenta player_tag (v4.2) ou agente_tag (v4.0)
            const payload = {
                match_id: match.match_id,
                status: 'pending',
                error_message: null
            };

            // Detecta qual coluna usar (baseado no que o worker.js v4.2 espera)
            payload.player_tag = match.player_id; 

            const { error: insErr } = await activeQueueClient.from('match_analysis_queue').insert([payload]);

            if (insErr) {
                // Tenta fallback para agente_tag se player_tag falhar
                payload.agente_tag = match.player_id;
                delete payload.player_tag;
                const { error: insErr2 } = await activeQueueClient.from('match_analysis_queue').insert([payload]);
                
                if (!insErr2) {
                    successCount++;
                } else {
                    console.error(`\n❌ Falha Match ${match.match_id}: ${insErr2.message}`);
                }
            } else {
                successCount++;
            }

            if (successCount % 10 === 0) {
                process.stdout.write(`\r🚀 Progresso: ${successCount}/${allMatches.length}`);
            }
            
            await new Promise(r => setTimeout(r, 20)); 
        }

        console.log(`\n\n✅ [FINALIZADO] ${successCount} partidas re-enfileiradas cronologicamente.`);
        console.log("🚀 Inicie o worker (npm start ou node worker.js) para processar a inteligência do zero.");

    } catch (err) {
        console.error(`\n💥 ERRO CRÍTICO: ${err.message}`);
    }
}

reprocessEverything();
