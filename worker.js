/**
 * worker.js
 * 
 * The execution engine for Oráculo V.
 * Refactored to be a service-based engine instead of a polling worker.
 * Receives data directly from Protocolo-V via API.
 */
import { supabase, supabaseProtocol } from './lib/supabase.js';
import ImpactAnalyzer from './services/ImpactAnalyzer.js';
import { execSync } from 'child_process';
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
        
        // 5. Cálculo do Score de Impacto (ImpactAnalyzer)
        const impact = ImpactAnalyzer.calculate({
            adr: result.adr,
            kast: result.kast,
            first_bloods: result.first_kills,
            clutches: result.clutches,
            acs: result.acs,
            agent: result.agent,
            role: result.role
        });

        // 6. Persistência Técnica (Oráculo-V)
        // Guardamos o registro técnico antes da camada de IA
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
            impact_score: impact.score,
            impact_rank: impact.rank
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

        // 6.5. Buscar Template de Rank (Estilo de Comentário)
        let rankTemplate = null;
        try {
            const { data: templates } = await supabase
                .from('round_comment_templates')
                .select('template')
                .eq('event_type', impact.rank)
                .limit(1);
            if (templates && templates.length > 0) rankTemplate = templates[0].template;
        } catch (templateErr) {
            console.warn("⚠️ [DB] Falha ao ler templates de rank:", templateErr.message);
        }

        const promptData = {
            match_data: {
                perf: impact.score,
                rank: impact.rank,
                agent: result.agent,
                map: result.map,
                kd: result.kd, 
                acs: result.acs,
                total_rounds: result.total_rounds,
                conselhosBase: result.all_conselhos,
                tone_instruction: impact.tone_instruction,
                template_hint: rankTemplate,
                abilities: briefing.ability_context || [] // [NOVO] Keywords técnicas
            },
            trend: null, // As tendências agora são baseadas no Holt local
            history: previousInsights,
            squad: briefing.squad_stats || null
        };

        // Geração Resiliente: Timeout 10s para Local e Fallback Automático Elite
        const aiResponse = await generateInsights(promptData);
        if (aiResponse) {
            console.log(`🤖 Insight LLM (${aiResponse.model_used}) Recebido.`);
            
            // Gravação Local (Oráculo-V) com RAW DATA SNAPSHOT
            await supabase.from('ai_insights').insert([{
                match_id: match_id,
                player_id: player_id,
                insight_resumo: aiResponse.insight,
                model_used: aiResponse.model_used,
                raw_data_snapshot: raw_data || briefing
            }]);

            // SINCRONIZAÇÃO DUAL-BASE: Gravação no Protocolo-V (Dashboard)
            if (supabaseProtocol) {
                console.log(`📡 [SYNC] Sincronizando insight para o Protocolo-V...`);
                const { error: syncErr } = await supabaseProtocol.from('ai_insights').upsert([{
                    match_id: match_id,
                    player_id: player_id,
                    insight_resumo: aiResponse.insight.diagnostico_principal || aiResponse.insight,
                    classification: impact.rank,
                    impact_score: impact.score,
                    model_used: aiResponse.model_used
                }], { onConflict: 'match_id, player_id' });
                if (syncErr) console.warn(`⚠️ [SYNC] Falha ao espelhar no Protocolo: ${syncErr.message}`);
                else console.log(`✅ [SYNC] Insight espelhado com sucesso.`);
            }
        } else {
            throw new Error("Falha Crítica: Nenhuma IA (OpenRouter ou Local) retornou resposta válida.");
        }

        console.log(`🏁 [ENGINE] Match ${match_id} finalizado.`);
        return { 
            success: true, 
            result,
            insight: {
                resumo: aiResponse.insight.diagnostico_principal || aiResponse.insight,
                rank: impact.rank,
                score: impact.score,
                model_used: aiResponse.model_used
            }
        };

    } catch (err) {
        console.error("❌ Erro no Processamento:", err.message);
        return { success: false, error: err.message };
    }
}
