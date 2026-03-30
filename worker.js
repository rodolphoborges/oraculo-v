/**
 * worker.js
 * 
 * The execution engine for Oráculo V.
 * [v4.2.1-STABLE] - Versionamento de Motor e Logs Táticos Integrados.
 */
const ORACULO_ENGINE_VERSION = '4.2.1'; // Incrementing this forces re-analysis for older records
import { supabase, supabaseProtocol } from './lib/supabase.js';
import path from 'path';
import fs from 'fs';
import { generateInsights } from './lib/openrouter_engine.js';

/**
 * worker.js 
 * 
 * Consome a fila do Supabase e executa a análise de partida.
 * Ideal para rodar como GitHub Action cron ou serviço persistente.
 */

async function getPlayerHoltState(agenteTag) {
    if (!supabaseProtocol) return null;
    const { data: player } = await supabaseProtocol
        .from('players')
        .select('performance_l, performance_t, kd_l, kd_t, adr_l, adr_t')
        .eq('riot_id', agenteTag)
        .single();
    
    if (player && player.performance_l !== null) {
        return player;
    }

    // Inicialização: Média das 3 primeiras partidas
    const { data: matches } = await supabase
        .from('match_stats')
        .select('impact_score, kd, adr')
        .eq('player_id', agenteTag)
        .order('created_at', { ascending: true })
        .limit(3);

    if (matches && matches.length === 3) {
        console.log(`🧠 [WORKER] Inicializando Holt para ${agenteTag} com base em 3 partidas.`);
        const L0_perf = matches.reduce((acc, m) => acc + (m.impact_score || 0), 0) / 3;
        const L0_kd = matches.reduce((acc, m) => acc + (m.kd || 0), 0) / 3;
        const L0_adr = matches.reduce((acc, m) => acc + (m.adr || 0), 0) / 3;

        // T0 = média das diferenças
        const T0_perf = ((matches[1].perf - matches[0].perf) + (matches[2].perf - matches[1].perf)) / 2;
        const T0_kd = ((matches[1].kd - matches[0].kd) + (matches[2].kd - matches[1].kd)) / 2;
        const T0_adr = ((matches[1].adr - matches[0].adr) + (matches[2].adr - matches[1].adr)) / 2;

        const initialState = {
            performance_l: L0_perf, performance_t: T0_perf,
            kd_l: L0_kd, kd_t: T0_kd,
            adr_l: L0_adr, adr_t: T0_adr
        };

        if (supabaseProtocol) {
            await supabaseProtocol.from('players').update(initialState).eq('riot_id', agenteTag);
        }
        return initialState;
    }

    return null;
}

/**
 * Processa um briefing recebido do Protocolo-V.
 * @param {object} briefing Dados estruturados da partida
 */
export async function processBriefing(briefing) {
    const { match_id, player_id, map_name, agent_name, raw_data } = briefing;

    console.log(`👷 Processando Briefing: Match ${match_id} (Player: ${player_id})`);

    try {
        // 1. Validar existência do jogador no banco de dados (Segurança contra deletados)
        if (supabaseProtocol) {
            const { data: exists, error: checkErr } = await supabaseProtocol
                .from('players')
                .select('riot_id')
                .ilike('riot_id', player_id)
                .maybeSingle();

            if (!exists || checkErr) {
                // Aborta silenciosamente se for erro de "não localizado" para evitar spam no terminal
                return { success: false, error: "não encontrado" }; 
            }
        }

        // 3. Buscar Estado Holt Anterior
        const holtPrev = await getPlayerHoltState(player_id);

        // 4. Executar o sistema de análise
        const { spawnSync } = await import('child_process');
        const { runAnalysis } = await import('./analyze_match.js');
        const result = await runAnalysis(
            player_id, 
            match_id, 
            map_name || 'ALL', 
            'ALL', 
            holtPrev || {},
            agent_name || 'ALL'
        );

        if (result.error) throw new Error(result.error);

        // 6. Atualizar Estado Holt no Jogador (se disponível)
        if (result.holt && result.holt.performance_l !== null && supabaseProtocol) {
            console.log(`📈 [WORKER] Atualizando tendência para ${player_id}`);
            await supabaseProtocol.from('players').update({
                performance_l: result.holt.performance_l,
                performance_t: result.holt.performance_t,
                kd_l: result.holt.kd_l,
                kd_t: result.holt.kd_t,
                adr_l: result.holt.adr_l,
                adr_t: result.holt.adr_t
            }).eq('riot_id', player_id);
        }

        console.log("✅ Análise concluída com sucesso.");

        // 5. FONTE ÚNICA: Usar performance_index do Python (elimina dupla avaliação)
        const performanceIndex = result.performance_index || 0;
        const technicalRank = result.technical_rank || 'Depósito de Torreta';
        const toneInstruction = result.tone_instruction || '';

        // 6. Persistência Técnica (Oráculo-V)
        // Guardamos o registro técnico derivado do performance_index (Python)
        await supabase.from('match_stats').upsert([{
            match_id: match_id,
            player_id: player_id,
            agent: result.agent,
            role: result.role,
            kills: result.kills,
            deaths: result.deaths,
            acs: result.acs,
            adr: result.adr,
            kast: result.kast,
            first_bloods: result.first_kills,
            clutches: result.clutches,
            is_win: result.is_win,
            impact_score: performanceIndex,
            impact_rank: technicalRank
        }], { onConflict: 'match_id, player_id' });

        // 6.4. Buscar Tendências Reais/Insights anteriores para a LLM
        let previousInsights = null;
        try {
            const { data: pastInsights } = await supabase
                .from('ai_insights')
                .select('insight_resumo')
                .eq('player_id', player_id)
                .order('created_at', { ascending: false })
                .limit(2);
            if (pastInsights) previousInsights = pastInsights.map(i => i.insight_resumo);
        } catch (queryErr) {
            console.warn("⚠️ [DB] Falha ao ler insights anteriores para a LLM:", queryErr.message);
        }

        const promptData = {
            match_data: {
                perf: performanceIndex,
                rank: technicalRank,
                role: result.role,
                agent: result.agent,
                map: result.map,
                kd: result.kd,
                adr: result.adr,
                kast: result.kast,
                acs: result.acs,
                first_kills: result.first_kills,
                clutches: result.clutches,
                total_rounds: result.total_rounds,
                conselhosBase: result.all_conselhos,
                tone_instruction: toneInstruction,
                abilities: briefing.ability_context || []
            },
            trend: null,
            history: previousInsights,
            squad: briefing.squad_stats || null
        };

        // 6.7. Geração Resiliente: Timeout longo e Fallback Automático Elite
        const aiResponse = await generateInsights(promptData);

        // 6.8. Tratamento de Falha da IA — Fallback Estruturado para manter a UI estável
        let finalInsight = null;
        if (aiResponse && typeof aiResponse.insight === 'object') {
            console.log(`🤖 Insight LLM (${aiResponse.model_used}) Recebido.`);
            finalInsight = aiResponse.insight;
        } else {
            console.warn(`⚠️ [AI-FAILURE] Nenhuma IA respondeu. Gerando Fallback Estruturado.`);
            // Fallback baseado nos conselhos base do Python, mas estruturado para a UI
            finalInsight = {
                diagnostico_principal: result.conselho_kaio || "Análise básica concluída (IA em manutenção).",
                pontos_fortes: result.all_conselhos ? result.all_conselhos.filter(c => !c.includes('VIOLAÇÃO') && !c.includes('ALERTA')).slice(0, 2) : ["Consistência técnica baseline"],
                pontos_fracos: result.all_conselhos ? result.all_conselhos.filter(c => c.includes('VIOLAÇÃO') || c.includes('ALERTA')).slice(0, 2) : ["Otimização de impacto pendente"],
                nota_coach: (performanceIndex / 15).toFixed(1), // Nota proporcional ao performance_index
                classification: technicalRank,
                is_fallback: true
            };
            if (finalInsight.pontos_fortes.length === 0) finalInsight.pontos_fortes = ["Posicionamento padrão"];
            if (finalInsight.pontos_fracos.length === 0) finalInsight.pontos_fracos = ["Padrão de movimentação a refinar"];
        }

        // 7. Persistência dO Insight (Oráculo - Resiliente a Schema)
        try {
            // Remove registro antigo (Case-Insensitive para Player ID)
            const { count, error: delErr } = await supabase
                .from('ai_insights')
                .delete({ count: 'exact' })
                .eq('match_id', match_id)
                .ilike('player_id', player_id); 
            
            if (delErr) {
                console.warn(`⚠️ [DB] Falha na purga: ${delErr.message}`);
            }

            const { error: insErr } = await supabase.from('ai_insights').insert([{
                player_id: player_id,
                match_id: match_id,
                insight_resumo: JSON.stringify(finalInsight),
                created_at: new Date().toISOString()
            }]);

            if (insErr) console.error(`   [❌] Falha no Oráculo: ${insErr.message}`);

            // 8. Espelhamento no Protocolo-V (Log de DNA para melhoria do Prompt)
            if (supabaseProtocol) {
                const enrichedReport = { ...result, impact_score: performanceIndex };
                
                // DNA Minificado: Essencial para debugar o Ollama depois
                const auditDNA = {
                    v: ORACULO_ENGINE_VERSION,
                    model: aiResponse?.model_used || "FALLBACK",
                    tone: toneInstruction,
                    ts: new Date().toISOString()
                };

                const { error: syncErr } = await supabaseProtocol.from('ai_insights').upsert([{
                    player_id: player_id,
                    match_id: match_id,
                    insight_resumo: JSON.stringify(finalInsight),
                    analysis_report: { ...enrichedReport, _audit: auditDNA },
                    model_used: auditDNA.model,
                    classification: finalInsight.classification || technicalRank,
                    impact_score: performanceIndex,
                    engine_version: ORACULO_ENGINE_VERSION,
                    created_at: new Date().toISOString()
                }], { onConflict: 'match_id, player_id' });

                if (syncErr) console.warn(`⚠️ [SYNC] Falha no Protocolo: ${syncErr.message}`);
                else console.log(`✅ [SYNC] Insight v${ORACULO_ENGINE_VERSION} espelhado.`);
            }

            // 9. Sincronização de Arquivo Local (Analyses/)
            const reportPath = path.join(process.cwd(), 'analyses', `match_${match_id}_${player_id.replace('#', '_')}.json`);
            try {
                const fileContent = await fs.promises.readFile(reportPath, 'utf8');
                const currentReport = JSON.parse(fileContent);
                currentReport.conselho_kaio = finalInsight; 
                currentReport.engine_version = ORACULO_ENGINE_VERSION;
                await fs.promises.writeFile(reportPath, JSON.stringify(currentReport, null, 2), 'utf8');
            } catch (fileErr) {}
        } catch (err) {
            console.error(`❌ Erro na persistência: ${err.message}`);
        }

        console.log(`🏁 [ENGINE] Match ${match_id} finalizado.`);
        return {
            success: true,
            result,
            insight: {
                resumo: finalInsight.diagnostico_principal,
                rank: technicalRank,
                score: performanceIndex,
                model_used: aiResponse?.model_used || "SYSTEM_FALLBACK"
            }
        };


    } catch (err) {
        console.error("❌ Erro no Processamento:", err.message || err);
        return { success: false, error: err.message || String(err) || "Erro interno desconhecido no worker." };
    }
}

/**
 * Loop principal que monitora a fila de análise no Supabase.
 * - Processa jobs com status 'pending'
 * - Reenfileira jobs 'failed' com backoff exponencial (máx 3 tentativas):
 *     tentativa 1 → aguarda 5min, tentativa 2 → 15min, tentativa 3 → 60min
 */
export async function startWorker() {
    console.log('🤖 [ORACULO-V] Motor de análise em background iniciado.');

    const RETRY_DELAYS_MS = [5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000];
    const MAX_RETRIES = RETRY_DELAYS_MS.length;

    // --- [ESTIMADOR TÁTICO v4.2] ---
    let jobTimeSamples = [];
    const MAX_SAMPLES = 5; 
    let totalProcessedThisSession = 0;

    function getETA(pendingCount) {
        if (jobTimeSamples.length === 0) return "CALCULANDO...";
        const avg = jobTimeSamples.reduce((a, b) => a + b, 0) / jobTimeSamples.length;
        const totalRemainingSeconds = (avg * pendingCount) / 1000;
        
        if (totalRemainingSeconds < 60) return `${Math.ceil(totalRemainingSeconds)}s`;
        const mins = Math.floor(totalRemainingSeconds / 60);
        const secs = Math.ceil(totalRemainingSeconds % 60);
        return `${mins}m ${secs}s`;
    }
    // -------------------------------

    setInterval(async () => {
        if (!supabaseProtocol) return;
        try {
            // 1. Tentar processar o próximo job pendente
            const { data: queueItem } = await supabaseProtocol
                .from('match_analysis_queue')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: true })
                .limit(1)
                .single();

            if (queueItem) {
                const { id, player_tag: player_id, match_id } = queueItem;
                
                // 1.1 Consultar total pendente para o estimador
                const { count: pendingCount } = await supabaseProtocol
                    .from('match_analysis_queue')
                    .select('*', { count: 'exact', head: true })
                    .eq('status', 'pending');

                await supabaseProtocol.from('match_analysis_queue').update({ status: 'processing' }).eq('id', id);
                
                const eta = getETA(pendingCount || 0);
                console.log(`\n📡 [QUEUE] Analisando: ${player_id} | Restantes: ${pendingCount} | ETA: ${eta}`);
                
                const startTime = Date.now();
                const result = await processBriefing({ match_id, player_id, map_name: null, agent_name: null });
                const duration = Date.now() - startTime;

                if (result.success) {
                    // Atualiza métricas de tempo
                    jobTimeSamples.push(duration);
                    if (jobTimeSamples.length > MAX_SAMPLES) jobTimeSamples.shift();
                    totalProcessedThisSession++;

                    // Remover da fila após sucesso
                    await supabaseProtocol.from('match_analysis_queue')
                        .delete()
                        .eq('id', id);
                    console.log(`✅ [QUEUE] Concluído em ${(duration/1000).toFixed(1)}s (Total: ${totalProcessedThisSession})`);
                } else {
                    // Se o erro for de jogador não encontrado (deletado), removemos da fila para evitar loop infinito
                    if (result.error && result.error.includes("não encontrado")) {
                        console.warn(`🗑️ [QUEUE] Jogador não encontrado no sistema. Removendo Job obsoleto: ${player_id}`);
                        await supabaseProtocol.from('match_analysis_queue').delete().eq('id', id);
                    } else {
                        const retryCount = (queueItem.retry_count || 0) + 1;
                        if (retryCount <= MAX_RETRIES) {
                            const delayMs = RETRY_DELAYS_MS[retryCount - 1];
                            const retryAfter = new Date(Date.now() + delayMs).toISOString();
                            console.warn(`⏳ [RETRY] Job ${id} falhará — tentativa ${retryCount}/${MAX_RETRIES}. Próximo retry em ${delayMs / 60000}min.`);
                            await supabaseProtocol.from('match_analysis_queue')
                                .update({ status: 'failed', error_msg: result.error, retry_count: retryCount, retry_after: retryAfter })
                                .eq('id', id);
                        } else {
                            console.error(`❌ [QUEUE] Job ${id} esgotou ${MAX_RETRIES} tentativas.`);
                            await supabaseProtocol.from('match_analysis_queue')
                                .update({ status: 'failed', error_msg: `[MAX_RETRIES] ${result.error}` })
                                .eq('id', id);
                        }
                    }
                }
                return; // Processou um job, aguarda o próximo tick
            }

            // 2. Verificar jobs 'failed' elegíveis para retry (retry_after no passado)
            const now = new Date().toISOString();
            const { data: retryItem } = await supabaseProtocol
                .from('match_analysis_queue')
                .select('*')
                .eq('status', 'failed')
                .not('retry_after', 'is', null)
                .lte('retry_after', now)
                .order('retry_after', { ascending: true })
                .limit(1)
                .single();

            if (retryItem) {
                console.log(`🔁 [RETRY] Reenfileirando job ${retryItem.id} (tentativa ${retryItem.retry_count || 1}).`);
                await supabaseProtocol.from('match_analysis_queue')
                    .update({ status: 'pending', retry_after: null })
                    .eq('id', retryItem.id);
            }

        } catch (err) {
            console.error('❌ [QUEUE-ERROR] Falha no loop do worker:', err.message);
        }
    }, 5000); // Verifica a cada 5 segundos

    // Limpeza periódica: remover jobs falhados com mais de 7 dias
    setInterval(async () => {
        try {
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const { count: deletedCount } = await supabaseProtocol
                .from('match_analysis_queue')
                .delete({ count: 'exact' })
                .eq('status', 'failed')
                .lt('created_at', sevenDaysAgo);

            if (deletedCount > 0) {
                console.log(`🗑️ [CLEANUP] ${deletedCount} jobs falhados antigos removidos da fila`);
            }
        } catch (err) {
            console.error('[CLEANUP] Erro na limpeza:', err.message);
        }
    }, 60 * 60 * 1000); // A cada 1 hora
}
