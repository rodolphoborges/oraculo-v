
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

        // 3. Limpeza da Fila Atual (para evitar duplicidade)
        if (supabaseProtocol) {
            console.log("🧹 [QUEUE] Limpando fila de análise atual...");
            await supabaseProtocol.from('match_analysis_queue').delete().neq('id', 0);
        }

        // 4. Re-enfileiramento Cronológico
        console.log(`♻️ [REQUEUE] Enfileirando ${allMatches.length} partidas na ordem correta...`);
        
        // Vamos inserir um por um ou em pequenos batches para garantir a ordem exata de processamento no worker (.order('created_at'))
        // O worker usa 'created_at' do match_analysis_queue, então a ordem de inserção aqui define a ordem de processamento.
        
        let successCount = 0;
        for (const match of allMatches) {
            const { error: insErr } = await supabaseProtocol.from('match_analysis_queue').insert([{
                match_id: match.match_id,
                player_tag: match.player_id,
                status: 'pending',
                error_message: null
            }]);

            if (!insErr) {
                successCount++;
                if (successCount % 10 === 0) {
                    process.stdout.write(`\r🚀 Progresso: ${successCount}/${allMatches.length}`);
                }
            } else {
                console.error(`\n❌ Falha ao enfileirar Match ${match.match_id} (Player: ${match.player_id}): ${insErr.message}`);
            }
            
            // Pequeno delay para garantir que os timestamps 'created_at' no banco sejam ligeiramente diferentes
            await new Promise(r => setTimeout(r, 50)); 
        }

        console.log(`\n\n✅ [FINALIZADO] ${successCount} partidas re-enfileiradas cronologicamente.`);
        console.log("🚀 Inicie o worker (npm start ou node worker.js) para processar a inteligência do zero.");

    } catch (err) {
        console.error(`\n💥 ERRO CRÍTICO: ${err.message}`);
    }
}

reprocessEverything();
