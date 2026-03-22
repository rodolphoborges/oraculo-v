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

/**
 * worker.js 
 * 
 * Consome a fila do Supabase e executa a análise de partida.
 * Ideal para rodar como GitHub Action cron ou serviço persistente.
 */

async function getPlayerHoltState(agenteTag) {
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
            performance_L: L0_perf, performance_T: T0_perf,
            kd_L: L0_kd, kd_T: T0_kd,
            adr_L: L0_adr, adr_T: T0_adr
        };

        // Salvar No Protocolo (Persistência)
        await supabaseProtocol.from('players').update(initialState).eq('riot_id', agenteTag);
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

    if (error || !job) {
        return false;
    }

    console.log(`👷 Processando Job: Match ${job.match_id} (Player: ${job.agente_tag})`);

    try {
        // 2. Marcar como 'processing'
        const { error: procError } = await supabase.from('match_analysis_queue').update({ 
            status: 'processing',
            processed_at: new Date().toISOString()
        }).eq('id', job.id);
        if (procError) throw new Error(`Erro ao marcar como processing: ${procError.message}`);

        if (job.agente_tag === 'AUTO') {
            console.log(`⚠️ [WORKER] Modo AUTO detectado, mas desativado no Worker.`);
            await supabase.from('match_analysis_queue').update({ 
                status: 'failed',
                error_msg: "Modo AUTO deve ser expandido na origem (Radar/Bot) para manter o Worker focado em expertise."
            }).eq('id', job.id);
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
            metadata: { 
                ...job.metadata, 
                agent: result.agent, 
                map: result.map,
                perf: result.performance_index,
                holt: result.holt,
                analysis: result 
            }
        }).eq('id', job.id);

        if (completeError) throw new Error(`Erro ao salvar no Supabase (completed): ${completeError.message}`);

        // 6. Atualizar Estado Holt no Jogador (se disponível)
        if (result.holt && result.holt.performance_L !== null) {
            console.log(`📈 [WORKER] Atualizando tendência para ${job.agente_tag}`);
            await supabaseProtocol.from('players').update({
                performance_l: result.holt.performance_L,
                performance_t: result.holt.performance_T,
                kd_l: result.holt.kd_L,
                kd_t: result.holt.kd_T,
                adr_l: result.holt.adr_L,
                adr_t: result.holt.adr_T
            }).eq('riot_id', job.agente_tag);
        }

        console.log("✅ Análise concluída com sucesso.");

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
