import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

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
        console.log("📭 Fila vazia. Finalizando.");
        return;
    }

    console.log(`👷 Processando Job: Match ${job.match_id} (Player: ${job.player_tag})`);

    try {
        // 2. Marcar como 'processing'
        await supabase.from('match_analysis_queue').update({ 
            status: 'processing',
            processed_at: new Date().toISOString()
        }).eq('id', job.id);

        // 3. Executar o sistema de análise
        // Usamos spawnSync para evitar injeção de comandos via shell
        const { spawnSync } = await import('child_process');
        console.log(`🚀 Iniciando análise: node analyze_match.js "${job.player_tag}" "${job.match_id}"`);
        
        const child = spawnSync('node', ['analyze_match.js', job.player_tag, job.match_id], { encoding: 'utf-8' });
        
        if (child.error) throw child.error;
        const output = child.stdout;
        
        // Filtrar a saída para pegar apenas o ÚLTIMO bloco JSON (o resultado real)
        const jsonBlocks = output.match(/\{[\s\S]*?\}/g);
        if (!jsonBlocks) throw new Error("A saída do analisador não contém um JSON válido: " + output);
        
        // Pegamos o último bloco que parece ser o objeto de resposta
        const lastJson = jsonBlocks[jsonBlocks.length - 1];
        const result = JSON.parse(lastJson);

        if (result.error) throw new Error(result.error);

        // 4. Salvar resultado e marcar como completo
        // No futuro, poderíamos gerar uma imagem aqui ou um link para o site
        await supabase.from('match_analysis_queue').update({ 
            status: 'completed',
            metadata: { 
                ...job.metadata, 
                agent: result.agent, 
                map: result.map,
                perf: result.performance_index
            }
        }).eq('id', job.id);

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
        await supabase.from('match_analysis_queue').update({ 
            status: 'failed',
            error_msg: err.message
        }).eq('id', job.id);
    }
}

processQueue();
