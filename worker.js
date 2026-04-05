/**
 * worker.js
 * 
 * Motor de execução desacoplado do Oráculo V.
 * [v5.1.0-NATURAL-JS] - Comunicação via Webhook e Motor JS Nativo.
 */
import { supabase } from './lib/supabase.js';
import path from 'path';
import fs from 'fs';
import { generateInsights } from './lib/openrouter_engine.js';
import { runTribunal } from './lib/tribunal_engine.js';

const ORACULO_ENGINE_VERSION = '5.1.0';

/**
 * Busca o estado Holt-Winters local ou inicializa se necessário.
 * Nota: Agora o Oráculo mantém seu próprio cache de tendências para performance,
 * mas a "Verdade Absoluta" é devolvida ao Protocolo via Webhook.
 */
async function getPlayerHoltState(agenteTag) {
    // Tenta buscar do cache local (match_stats) para ter uma base de cálculo
    const { data: matches } = await supabase
        .from('match_stats')
        .select('impact_score, kd, adr')
        .eq('player_id', agenteTag)
        .order('created_at', { ascending: false })
        .limit(3);

    if (matches && matches.length >= 1) {
        // Cálculo simplificado de nível atual (Level) baseado na última partida
        // A tendência (Trend) será recalculada pelo motor JS
        return {
            performance_l: matches[0].impact_score,
            performance_t: 0,
            kd_l: matches[0].kd,
            kd_t: 0,
            adr_l: Math.round(matches[0].adr || 0),
            adr_t: 0
        };
    }

    return null;
}

/**
 * Processa um job da fila.
 */
export async function processBriefing(briefing) {
    const { match_id, player_id, map_name, agent_name, metadata = {} } = briefing;
    const PROTOCOL_URL = process.env.PROTOCOL_API_URL || 'http://localhost:3000';
    const ADMIN_KEY = process.env.ADMIN_API_KEY;

    console.log(`👷 [WORKER] Iniciando Match ${match_id} | Player: ${player_id}`);

    try {
        // 1. Buscar Estado Holt (Prioriza o que veio no Job Metadata, fallback local)
        const holtPrev = metadata.holt_state || await getPlayerHoltState(player_id);

        // 2. Executar análise via Motor JS Nativo
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

        // 3. Pipeline de IA (Tribunal ou OpenRouter)
        let aiResponse = null;
        try {
            const matchJsonPath = path.join(process.cwd(), 'matches', `${match_id}.json`);
            const matchRaw = await fs.promises.readFile(matchJsonPath, 'utf8');
            const matchData = JSON.parse(matchRaw);
            aiResponse = await runTribunal(matchData, result, player_id, match_id);
        } catch (e) {
            console.warn(`⚠️ [TRIBUNAL] Pulado ou falhou: ${e.message}`);
            aiResponse = await generateInsights({ match_data: result });
        }

        const finalInsight = aiResponse?.insight || { 
            diagnostico_principal: result.conselho_kaio || "Análise concluída.",
            classification: result.technical_rank,
            is_fallback: true 
        };

        // 4. Persistência Local (Oráculo-V - Soberania Técnica)
        await supabase.from('match_stats').upsert([{
            match_id, player_id, agent: result.agent, role: result.role,
            kills: result.kills, deaths: result.deaths, acs: result.acs,
            adr: result.adr, kast: result.kast, first_bloods: result.first_kills,
            clutches: result.clutches, is_win: result.is_win,
            impact_score: result.performance_index, impact_rank: result.technical_rank
        }], { onConflict: 'match_id, player_id' });

        // 5. CALLBACK: Devolução de dados ao Protocolo-V (Soberania de Dados)
        console.log(`📤 [CALLBACK] Enviando resultados para ${PROTOCOL_URL}...`);
        
        const callbackPayload = {
            match_id,
            player_id,
            insight_resumo: finalInsight,
            analysis_report: { ...result, engine_version: ORACULO_ENGINE_VERSION },
            model_used: aiResponse?.model_used || "SYSTEM_JS",
            classification: result.technical_rank,
            impact_score: result.performance_index,
            engine_version: ORACULO_ENGINE_VERSION,
            holt_state: result.holt // Novo estado calculado para o próximo job
        };

        try {
            const response = await fetch(`${PROTOCOL_URL}/api/insights/callback`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-api-key': ADMIN_KEY
                },
                body: JSON.stringify(callbackPayload)
            });

            if (!response.ok) {
                const errTxt = await response.text();
                throw new Error(`Falha no Callback (${response.status}): ${errTxt}`);
            }
        } catch (fetchErr) {
            console.warn(`⚠️ [WORKER] Webhook indisponível (${PROTOCOL_URL}). Tentando gravação direta no Protocolo...`);
            const pUrl = process.env.PROTOCOL_SUPABASE_URL;
            const pKey = process.env.PROTOCOL_SUPABASE_KEY;
            
            if (pUrl && pKey) {
                const { createClient } = await import('@supabase/supabase-js');
                const pSupabase = createClient(pUrl, pKey);
                
                await pSupabase.from('ai_insights').upsert({
                    match_id, player_id,
                    insight_resumo: finalInsight,
                    analysis_report: callbackPayload.analysis_report,
                    model_used: callbackPayload.model_used,
                    classification: result.technical_rank
                }, { onConflict: 'match_id,player_id' });
                
                console.log(`✅ [WORKER] Dados de ${player_id} gravados DIRETAMENTE com sucesso no Protocolo-V.`);
            } else {
                throw fetchErr;
            }
        }

        console.log(`✅ [WORKER] Ciclo completo para ${player_id}.`);
        return { success: true };

    } catch (err) {
        console.error(`❌ [WORKER ERROR] ${err.message}`);
        return { success: false, error: err.message };
    }
}

/**
 * Loop do Worker - Consome APENAS sua própria base de dados.
 */
export async function startWorker() {
    console.log(`🤖 [ORACULO-V] Worker v${ORACULO_ENGINE_VERSION} Ativo.`);

    setInterval(async () => {
        try {
            // 1. Pega o próximo job da fila LOCAL
            const { data: job } = await supabase
                .from('match_analysis_queue')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle();

            if (job) {
                const { id, agente_tag, match_id, metadata } = job;
                
                // Marcar como processando
                await supabase.from('match_analysis_queue').update({ status: 'processing' }).eq('id', id);
                
                console.log(`📡 [QUEUE] Processando: ${agente_tag} | Match: ${match_id}`);
                const result = await processBriefing({ 
                    match_id, 
                    player_id: agente_tag, 
                    metadata 
                });

                if (result.success) {
                    // Deletar da fila local após sucesso
                    await supabase.from('match_analysis_queue').delete().eq('id', id);
                } else {
                    // Marcar falha e logar
                    await supabase.from('match_analysis_queue').update({ 
                        status: 'failed', 
                        error_msg: result.error 
                    }).eq('id', id);
                }
            }
        } catch (err) {
            console.error(`❌ [LOOP ERROR] ${err.message}`);
        }
    }, 5000); 
}
