/**
 * worker.js
 * 
 * The main execution engine for Oráculo V.
 * This background worker monitors the 'match_analysis_queue' in Supabase,
 * orchestrates the browser-based scraping of battle data, and executes
 * the tactical analysis engine (analyze_valorant.py).
 * 
 * Multi-base connectivity:
 * - Reads/Writes 'match_analysis_queue' in ORÁCULO_V project.
 * - Reads 'players' info from PROTOCOLO_V project for group expansions.
 */
import { supabase, supabaseProtocol } from './lib/supabase.js';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { expandAutoJob } from './lib/job_expansion.js';
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
        .from('match_analysis_queue')
        .select('metadata->perf, metadata->analysis->kd, metadata->analysis->adr')
        .eq('agente_tag', agenteTag)
        .eq('status', 'completed')
        .order('created_at', { ascending: true })
        .limit(3);

    if (matches && matches.length === 3) {
        console.log(`🧠 [WORKER] Inicializando Holt para ${agenteTag} com base em 3 partidas.`);
        const L0_perf = matches.reduce((acc, m) => acc + m.perf, 0) / 3;
        const L0_kd = matches.reduce((acc, m) => acc + m.kd, 0) / 3;
        const L0_adr = matches.reduce((acc, m) => acc + m.adr, 0) / 3;

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

async function processQueue() {
    console.log("♻️ [WORKER] Verificando fila de processamento...");

    // 1. Pegar o item mais antigo 'pending'
    const { data: job, error } = await supabase
        .from('match_analysis_queue')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

    if (error) {
        if (error.code === 'PGRST116') { // Código do Postgrest para "0 rows returned"
            // Antes de desistir, vamos ver se não tem algum job "morto" (em processamento há muito tempo)
            const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
            const { data: staleJob } = await supabase
                .from('match_analysis_queue')
                .select('*')
                .eq('status', 'processing')
                .lt('processed_at', thirtyMinsAgo)
                .limit(1)
                .single();
            
            if (staleJob) {
                console.log(`⚠️ [WORKER] Detectado job "preso" (ID: ${staleJob.id}). Reabrindo para tentativa.`);
                await supabase.from('match_analysis_queue').update({ status: 'pending' }).eq('id', staleJob.id);
                return true; // Continua o loop para pegar esse job
            }

            return false; // Fila realmente vazia
        }
        
        console.error("❌ [WORKER] Erro ao buscar da fila:", error.message);
        // Em caso de erro de rede/conexão, retornamos true para o loop tentar novamente após um delay
        return true; 
    }

    if (!job) return false;

    console.log(`👷 Processando Job: Match ${job.match_id} (Player: ${job.agente_tag})`);

    try {
        // 2. Marcar como 'processing' com verificação de segurança (Double-Check)
        const { data: updatedJob, error: procError } = await supabase
            .from('match_analysis_queue')
            .update({ 
                status: 'processing',
                processed_at: new Date().toISOString(),
                error_message: null
            })
            .eq('id', job.id)
            .eq('status', 'pending') // Garante que ninguém pegou no milissegundo entre o select e o update
            .select();

        if (procError || !updatedJob || updatedJob.length === 0) {
            console.log(`[WORKER] Job ${job.id} já está sendo processado por outra instância. Pulando.`);
            return true;
        }

        if (job.agente_tag === 'AUTO') {
            try {
                const count = await expandAutoJob(job.match_id, job.chat_id, job.metadata);
                console.log(`🤖 [WORKER] AUTO Expandido: ${count} novos jobs.`);
                await supabase.from('match_analysis_queue').update({ 
                    status: 'completed',
                    processed_at: new Date().toISOString(),
                    error_message: null,
                    metadata: { ...job.metadata, expanded_count: count }
                }).eq('id', job.id);
            } catch (expansionErr) {
                console.error(`❌ [WORKER] Erro na expansão AUTO:`, expansionErr.message);
                await supabase.from('match_analysis_queue').update({ 
                    status: 'failed',
                    error_message: expansionErr.message
                }).eq('id', job.id);
            }
            return true;
        }

        // 3. Buscar Estado Holt Anterior
        const holtPrev = await getPlayerHoltState(job.agente_tag);

        // 4. Executar o sistema de análise
        const { spawnSync } = await import('child_process');
        console.log(`🚀 Iniciando análise: node analyze_match.js "${job.agente_tag}" "${job.match_id}"`);
        
        const runArgs = ['analyze_match.js', job.agente_tag, job.match_id];
        // Note: analyze_match.js runAnalysis doesn't take Holt state via CLI args easily unless we update its CLI handler
        // But we already updated analyze_match.js runAnalysis function. 
        // Let's call it direct if possible or update analyze_match.js CLI.
        
        // Actually, let's keep it simple: Call the function directly if we can, 
        // or just pass JSON string in env/args. 
        // Since we are in worker.js, we can import runAnalysis!
        const { runAnalysis } = await import('./analyze_match.js');
        const result = await runAnalysis(job.agente_tag, job.match_id, 'ALL', 'ALL', holtPrev || {});

        if (result.error) throw new Error(result.error);

        // 5. Salvar resultado e marcar como completo
        const { error: completeError } = await supabase.from('match_analysis_queue').update({ 
            status: 'completed',
            error_message: null,
            metadata: { 
                ...job.metadata, 
                agent: result.agent, 
                map: result.map,
                perf: result.performance_index,
                holt: result.holt,
                analysis: result,
                finished_at: new Date().toISOString()
            }
        }).eq('id', job.id);

        if (completeError) throw new Error(`Erro ao salvar no Supabase (completed): ${completeError.message}`);

        // 6. Atualizar Estado Holt no Jogador (se disponível)
        if (result.holt && result.holt.performance_l !== null && supabaseProtocol) {
            console.log(`📈 [WORKER] Atualizando tendência para ${job.agente_tag}`);
            await supabaseProtocol.from('players').update({
                performance_l: result.holt.performance_l,
                performance_t: result.holt.performance_t,
                kd_l: result.holt.kd_l,
                kd_t: result.holt.kd_t,
                adr_l: result.holt.adr_l,
                adr_t: result.holt.adr_t
            }).eq('riot_id', job.agente_tag);
        }

        console.log("✅ Análise concluída com sucesso.");

        // 6.5. Geração de Inteligência com OpenRouter
        const promptData = {
            match_data: {
                agent: result.agent, map: result.map,
                perf: result.performance_index,
                kd: result.kd, acs: result.acs,
                conselhosBase: result.all_conselhos
            },
            trend: holtPrev || "Histórico insuficiente",
            history: null, // Pode ser preenchido por uma select anterior na tabela ai_insights
            squad: null    // Pode ser hidratado do lib/strategic_advisor
        };
        const aiResponse = await generateInsights(promptData);
        if (aiResponse) {
            console.log(`🤖 Insight LLM (${aiResponse.model_used}) Recebido.`);
            await supabase.from('ai_insights').insert([{
                match_id: job.match_id,
                player_id: job.agente_tag,
                insight_resumo: aiResponse.insight,
                model_used: aiResponse.model_used
            }]);
        }

        // 7. Notificar via Telegram
        if (job.chat_id) {
            console.log(`📢 Notificando chat_id: ${job.chat_id}`);
            const botToken = process.env.TELEGRAM_BOT_TOKEN;
            if (botToken) {
                const trendIcon = result.holt?.performance_T > 0 ? '📈' : '📉';
                const trendMsg = result.holt?.performance_T ? `\nTendência: ${trendIcon} ${result.holt.performance_T > 0 ? '+' : ''}${result.holt.performance_T.toFixed(1)}%` : '';
                
                const message = `📡 *[ORÁCULO V: ANÁLISE PRONTA]*\n\nPartida: \`${job.match_id}\`\nAgente: *${result.agent}*\nPerformance: *${result.performance_index}%*${trendMsg}\n\nVisualize no terminal: [Abrir](https://protocolov.com/analise/${job.match_id})`;
                await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: job.chat_id,
                        text: message,
                        parse_mode: 'Markdown'
                    })
                });
            }
        }

    } catch (err) {
        console.error("❌ Erro no JOB:", err.message);
        await supabase.from('match_analysis_queue').update({ 
            status: 'failed',
            error_message: err.message
        }).eq('id', job.id);
        return true; 
    }
    return true;
}

async function startWorker() {
    console.log("🟢 [WORKER] Motor Tático Iniciado. Vigiando a fila...");
    // SUPORTE MANUAL VIA GITHUB ACTIONS
    if (process.env.MANUAL_PLAYER && process.env.MANUAL_MATCH) {
        console.log(`🎯 [MANUAL] Recebida solicitação manual para ${process.env.MANUAL_PLAYER} na partida ${process.env.MANUAL_MATCH}`);
        const { error: insError } = await supabase.from('match_analysis_queue').upsert([{
            match_id: process.env.MANUAL_MATCH.trim(),
            agente_tag: process.env.MANUAL_PLAYER.trim(),
            status: 'pending'
        }], { onConflict: 'match_id,agente_tag' });
        
        if (insError) console.error("❌ [MANUAL] Erro ao enfileirar job manual:", insError.message);
        else console.log("✅ [MANUAL] Job enfileirado com sucesso.");
    }

    while (true) {
        const processed = await processQueue();
        if (!processed) {
            // Se estiver rodando no GitHub Actions e a fila estiver vazia, encerra para não gastar minutos
            if (process.env.GITHUB_ACTIONS === 'true') {
                console.log("🏁 Fila vazia. Encerrando worker no GitHub Actions.");
                process.exit(0);
            }
            // Fila vazia, dorme 10 segundos
            await new Promise(res => setTimeout(res, 10000));
        } else {
            // Processou um job com sucesso (ou expandiu AUTO). Dá um respiro de 2s.
            await new Promise(res => setTimeout(res, 2000));
        }
    }
}

startWorker();
