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

        // Novo comportamento da fila: PROCESSAMENTO EM LOTE (AUTO)
        if (job.player_tag === 'AUTO') {
            console.log(`🤖 Modo AUTO: Buscando participantes da partida ${job.match_id}...`);
            
            // Importar a função de busca
            const { fetchMatchJson } = await import('./lib/tracker_api.js');
            
            // Garantir diretório local
            const matchesDir = './matches';
            if (!fs.existsSync(matchesDir)) fs.mkdirSync(matchesDir);
            
            const matchJsonPath = path.join(matchesDir, `${job.match_id}.json`);
            let matchData;
            
            if (fs.existsSync(matchJsonPath)) {
                matchData = JSON.parse(fs.readFileSync(matchJsonPath, 'utf8'));
            } else {
                matchData = await fetchMatchJson(job.match_id);
                fs.writeFileSync(matchJsonPath, JSON.stringify(matchData, null, 2));
            }
            
            // Extrair tags dos jogadores da partida
            const segments = matchData.data?.segments || [];
            const playersInMatch = segments
                .filter(s => s.type === 'player-summary' && s.attributes?.platformUserIdentifier)
                .map(s => s.attributes.platformUserIdentifier);
                
            console.log(`Pessoas na partida:`, playersInMatch.length > 0 ? playersInMatch.join(', ') : 'Nenhum encontrado');

            // Buscar todos os jogadores registrados no banco (FONTE: PROTOCOLO)
            const { data: dbPlayers } = await supabaseProtocol.from('players').select('riot_id');
            const registeredRiotIds = (dbPlayers || []).map(p => p.riot_id.toUpperCase());

            // Filtrar quem participou desta partida e está registrado no banco
            const targets = playersInMatch.filter(p => registeredRiotIds.includes(p.toUpperCase()));
            
            if (targets.length === 0) {
                console.log("❌ Nenhum agente do Protocolo V encontrado nesta partida.");
                await supabase.from('match_analysis_queue').update({ 
                    status: 'failed',
                    error_msg: "Nenhum agente registrado encontrado no JSON da partida"
                }).eq('id', job.id);
                
                if (job.chat_id) {
                    const botToken = process.env.TELEGRAM_BOT_TOKEN;
                    if (botToken) {
                        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                chat_id: job.chat_id,
                                text: `🤖 *[K.A.I.O.]*: Nenhum agente do Protocolo V foi identificado na partida \`${job.match_id}\`. Análise cancelada.`,
                                parse_mode: 'Markdown'
                            })
                        });
                    }
                }
                return;
            }

            console.log(`🎯 Agentes detectados nesta partida:`, targets.join(', '));

            // Inserir um job pendente individual para cada player, herdando o chat_id do solicitante
            for (const target of targets) {
                // Tenta achar o riot_id com o casing correto do banco de dados para evitar bugs
                const exactDbPlayer = dbPlayers.find(p => p.riot_id.toUpperCase() === target.toUpperCase());
                const finalTag = exactDbPlayer ? exactDbPlayer.riot_id : target;

                await supabase.from('match_analysis_queue').insert([{
                    match_id: job.match_id,
                    player_tag: finalTag,
                    chat_id: job.chat_id,
                    status: 'pending',
                    metadata: job.metadata || {}
                }]);
            }

            // Marca o job AUTO como processado (ou deleta) para não travar a fila
            await supabase.from('match_analysis_queue').update({ 
                status: 'completed',
                metadata: { ...job.metadata, note: `Expandido para ${targets.length} agentes` }
            }).eq('id', job.id);
            
            if (job.chat_id) {
                const botToken = process.env.TELEGRAM_BOT_TOKEN;
                if (botToken) {
                    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: job.chat_id,
                            text: `⚙️ *[K.A.I.O.]*: Partida decodificada. Identificados ${targets.length} agente(s). Iniciando análise individual...`,
                            parse_mode: 'Markdown'
                        })
                    });
                }
            }

            return; // Encerra o processamento do job AUTO. O worker pegará os novos jobs pendentes nas próximas execuções.
        }

        // 3. Executar o sistema de análise
        // Usamos spawnSync para evitar injeção de comandos via shell
        const { spawnSync } = await import('child_process');
        console.log(`🚀 Iniciando análise: node analyze_match.js "${job.player_tag}" "${job.match_id}"`);
        const child = spawnSync('node', ['analyze_match.js', job.player_tag, job.match_id], { 
            encoding: 'utf-8',
            env: { ...process.env, DOTENV_QUIET: 'true' },
            timeout: 10 * 60 * 1000 // 10 minutos de timeout
        });
        
        if (child.error) throw child.error;
        const output = child.stdout;
        
        // Filtrar a saída para pegar apenas o ÚLTIMO bloco JSON (o resultado real)
        const jsonBlocks = output.match(/\{[\s\S]*?\}/g);
        if (!jsonBlocks) {
            // Se não houver JSON, o erro provavelmente está no terminal
            const errorMsg = output.trim().split('\n').pop() || "Erro desconhecido na análise";
            throw new Error(`O analisador falhou: ${errorMsg}`);
        }
        
        // Pegamos o último bloco que parece ser o objeto de resposta
        let result;
        try {
            const lastJson = jsonBlocks[jsonBlocks.length - 1];
            result = JSON.parse(lastJson);
        } catch (e) {
            throw new Error("Falha ao processar o JSON de resultado do analisador.");
        }

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

await processQueue();
