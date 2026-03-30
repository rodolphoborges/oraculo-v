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
                role: impact.role,           // Função tática resolvida pelo ImpactAnalyzer
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
                tone_instruction: impact.tone_instruction,
                template_hint: rankTemplate,
                abilities: briefing.ability_context || []
            },
            trend: null, // As tendências agora são baseadas no Holt local
            history: previousInsights,
            squad: briefing.squad_stats || null
        };

        // Geração Resiliente: Timeout 10s para Local e Fallback Automático Elite
        const aiResponse = await generateInsights(promptData);
        if (aiResponse && typeof aiResponse.insight === 'object') {
            console.log(`🤖 Insight LLM (${aiResponse.model_used}) Recebido.`);
            
            // 4. Persistência dO Insight (Oráculo - Resiliente a Schema)
            try {
                // Remove registro antigo (Case-Insensitive para Player ID)
                const { count, error: delErr } = await supabase
                    .from('ai_insights')
                    .delete({ count: 'exact' })
                    .eq('match_id', match_id)
                    .ilike('player_id', player_id); // [NOVO] Deleta ousadia#013 ou OUSADIA#013
                
                if (delErr) {
                    console.warn(`⚠️ [DB] Falha na purga: ${delErr.message}`);
                } else {
                    console.log(`🧹 [PURGE] ${count || 0} registros antigos removidos.`);
                }

                const { error: insErr } = await supabase.from('ai_insights').insert([{
                    player_id: player_id,
                    match_id: match_id,
                    insight_resumo: JSON.stringify(aiResponse.insight),
                    created_at: new Date().toISOString()
                }]);

                if (insErr) console.error(`   [❌] Falha no Oráculo: ${insErr.message}`);

                // 5. Espelhamento no Protocolo-V (Completo - Com Métricas Táticas)
                if (supabaseProtocol) {
                    const { error: syncErr } = await supabaseProtocol.from('ai_insights').upsert([{
                        player_id: player_id,
                        match_id: match_id,
                        insight_resumo: (typeof aiResponse.insight === 'object') ? JSON.stringify(aiResponse.insight) : aiResponse.insight,
                        model_used: aiResponse.model_used,
                        classification: aiResponse.insight.classification || impact.rank,
                        impact_score: impact.score,
                        created_at: new Date().toISOString()
                    }], { onConflict: 'match_id, player_id' });
                    
                    if (syncErr) console.warn(`⚠️ [SYNC] Falha no Protocolo: ${syncErr.message}`);
                    else console.log(`✅ [SYNC] Insight espelhado com sucesso.`);
                }

                // [NOVO] Sincronização de Arquivo Local (Analyses/)
                // Garante que o Dashboard (que prefere o JSON local) receba o objeto estruturado
                const reportPath = path.join(process.cwd(), 'analyses', `match_${match_id}_${player_id.replace('#', '_')}.json`);
                try {
                    const fileContent = await fs.promises.readFile(reportPath, 'utf8');
                    const currentReport = JSON.parse(fileContent);
                    currentReport.conselho_kaio = aiResponse.insight; // Atualiza com o Objeto JSON
                    await fs.promises.writeFile(reportPath, JSON.stringify(currentReport, null, 2), 'utf8');
                    console.log(`📂 [FILE-SYNC] Arquivo local atualizado com Insight estruturado.`);
                } catch (fileErr) {
                    console.warn(`⚠️ [FILE-SYNC] Falha ao atualizar arquivo local: ${fileErr.message}`);
                }
            } catch (err) {
                console.error(`❌ Erro na persistência do insight: ${err.message}`);
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

/**
 * Loop principal que monitora a fila de análise no Supabase.
 */
export async function startWorker() {
    console.log('🤖 [ORACULO-V] Motor de análise em background iniciado.');
    
    // Loop infinito de monitoramento
    setInterval(async () => {
        try {
            // Busca o próximo item pendente na fila (no Protocolo-V)
            const { data: queueItem, error } = await supabaseProtocol
                .from('match_analysis_queue')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: true })
                .limit(1)
                .single();

            if (error || !queueItem) return; // Nada para processar

            const { id, player_id: player_id, match_id } = queueItem;

            // Marca como processando imediatamente no Protocolo-V
            await supabaseProtocol.from('match_analysis_queue').update({ status: 'processing' }).eq('id', id);

            console.log(`📡 [QUEUE] Iniciando análise de ${player_id} - Partida ${match_id}`);

            // Executa o processamento
            const result = await processBriefing({
                match_id,
                player_id,
                // O Oráculo-V busca os metadados restantes no Banco do Protocolo-V
                map_name: null,
                agent_name: null
            });

            // Atualiza o status final no Protocolo-V
            if (result.success) {
                await supabaseProtocol.from('match_analysis_queue').update({ status: 'completed' }).eq('id', id);
            } else {
                await supabaseProtocol.from('match_analysis_queue').update({ status: 'failed', error_msg: result.error }).eq('id', id);
            }

        } catch (err) {
            console.error('❌ [QUEUE-ERROR] Falha no loop do worker:', err.message);
        }
    }, 5000); // Verifica a cada 5 segundos
}
