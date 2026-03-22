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
        // console.log("📭 Fila vazia.");
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

        // Novo comportamento: O Worker é PURO. Não faz expansão AUTO.
        if (job.agente_tag === 'AUTO') {
            console.log(`⚠️ [WORKER] Modo AUTO detectado, mas desativado no Worker.`);
            await supabase.from('match_analysis_queue').update({ 
                status: 'failed',
                error_msg: "Modo AUTO deve ser expandido na origem (Radar/Bot) para manter o Worker focado em expertise."
            }).eq('id', job.id);
            return true;
        }

        // 3. Executar o sistema de análise
        // Usamos spawnSync para evitar injeção de comandos via shell
        const { spawnSync } = await import('child_process');
        console.log(`🚀 Iniciando análise: node analyze_match.js "${job.agente_tag}" "${job.match_id}"`);
        const child = spawnSync('node', ['analyze_match.js', job.agente_tag, job.match_id], { 
            encoding: 'utf-8',
            env: { ...process.env, DOTENV_QUIET: 'true' },
            timeout: 10 * 60 * 1000 // 10 minutos de timeout
        });
        
        if (child.error) throw child.error;
        const output = child.stdout;
        
        // Localizar o objeto JSON completo (do primeiro { ao último })
        const firstBrace = output.indexOf('{');
        const lastBrace = output.lastIndexOf('}');
        
        if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
            // Se não houver JSON, o erro provavelmente está no terminal ou no motor Python
            const stderrMsg = child.stderr ? child.stderr.trim() : "";
            
            // Pega as últimas 3 linhas do stdout caso não tenha JSON, para dar contexto
            const stdoutLines = output.trim().split('\n');
            const stdoutContext = stdoutLines.slice(-3).join(' | ');
            
            const errorMsg = stderrMsg || stdoutContext || "Erro desconhecido na análise (Sem saída JSON)";
            throw new Error(`O analisador falhou: ${errorMsg}`);
        }
        
        let result;
        try {
            const jsonText = output.substring(firstBrace, lastBrace + 1);
            result = JSON.parse(jsonText);
        } catch (e) {
            throw new Error("Falha ao processar o JSON de resultado do analisador (JSON malformado).");
        }

        if (result.error) throw new Error(result.error);

        // 4. Salvar resultado e marcar como completo
        // No futuro, poderíamos gerar uma imagem aqui ou um link para o site
        const { error: completeError } = await supabase.from('match_analysis_queue').update({ 
            status: 'completed',
            metadata: { 
                ...job.metadata, 
                agent: result.agent, 
                map: result.map,
                perf: result.performance_index,
                analysis: result // Salva o JSON do relatório completo aqui, conforme requisitado pelo frontend
            }
        }).eq('id', job.id);

        if (completeError) {
            throw new Error(`Erro ao salvar no Supabase (completed): ${completeError.message}`);
        }

        console.log("✅ Análise concluída com sucesso.");

        // 5. Notificar via Telegram (Opcional, mas recomendado)
        if (job.chat_id) {
            // Aqui poderíamos chamar uma API do Bot ou usar o token do Bot diretamente
            console.log(`📢 Notificando chat_id: ${job.chat_id}`);
            // Exemplo simplificado de chamada via Fetch (Bot API)
            const botToken = process.env.TELEGRAM_BOT_TOKEN;
            if (botToken) {
                const message = `📡 *[ORÁCULO V: ANÁLISE PRONTA]*\n\nPartida: \`${job.match_id}\`\nAgente: *${result.agent}*\nPerformance: *${result.performance_index}%*\n\nVisualize no terminal: [Abrir](https://protocolov.com/analise/${job.match_id})`;
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
        const { error: failError } = await supabase.from('match_analysis_queue').update({ 
            status: 'failed',
            error_message: err.message
        }).eq('id', job.id);
        if (failError) console.error("❌ Erro GRAVE ao marcar failed no Supabase:", failError.message);
        return true; // Continua a fila mesmo se um job falhar
    }
    return true; // Sucesso na análise padrão
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
