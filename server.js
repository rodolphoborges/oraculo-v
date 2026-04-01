import express from 'express';
import { runAnalysis } from './analyze_match.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getKnownAgents, getGlobalStrategicSummary } from './lib/tactical_knowledge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Core Database Connection
import { supabase, supabaseProtocol } from './lib/supabase.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Regex para validação de UUID
const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// Servir Protocolo-V docs (se existir) - permite acessar admin.html, analise.html, etc
const protocolovDocsPath = path.join(__dirname, '../protocolov/docs');
if (fs.existsSync(protocolovDocsPath)) {
  app.use('/protocol', express.static(protocolovDocsPath));
  console.log('📁 Protocolo-V docs servindo em /protocol');
}

import { processBriefing, startWorker } from './worker.js';

async function registerQueueJob(match_id, player_id, status = 'pending') {
    if (!supabaseProtocol) return;
    try {
        // Verificar se já existe na fila (Resiliente a falta de constraint)
        const { data: existing } = await supabaseProtocol
            .from('match_analysis_queue')
            .select('id')
            .eq('match_id', match_id)
            .eq('player_tag', player_id)
            .limit(1);

        if (existing && existing.length > 0) {
            // Se já existe e está falhado, podemos resetar para pending
            if (status === 'pending') {
              await supabaseProtocol.from('match_analysis_queue')
                  .update({ status, created_at: new Date().toISOString(), retry_count: 0 })
                  .eq('id', existing[0].id);
            }
            return;
        }

        await supabaseProtocol.from('match_analysis_queue').insert([{
            match_id,
            player_tag: player_id,
            status,
            created_at: new Date().toISOString()
        }]);
    } catch (err) {
        console.warn(`⚠️ [QUEUE-SYNC] Falha ao registrar job (${player_id}/${match_id}): ${err.message}`);
    }
}

// Middleware de Segurança para Rotas Administrativas
const adminAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const masterKey = process.env.ADMIN_API_KEY;
  const externalIp = process.env.EXTERNAL_IP || '191.180.122.186';

  // Permitir acesso local e externo sem chave (Dashboard)
  const isLocal = req.hostname === 'localhost' || req.hostname === '127.0.0.1' || req.hostname === externalIp;
  if (isLocal) return next();

  if (!masterKey) {
    console.error('[SECURITY] ADMIN_API_KEY não configurada no servidor.');
    return res.status(500).json({ error: 'Configuração de segurança pendente no servidor.' });
  }

  if (apiKey !== masterKey) {
    return res.status(401).json({ error: 'Acesso negado. API Key administrativa inválida ou ausente.' });
  }
  next();
};

app.post('/api/queue', async (req, res) => {
  const briefing = req.body;
  const { player_id, match_id } = briefing;

  if (!player_id || !match_id) {
    return res.status(400).json({ error: 'Player ID e Match ID são obrigatórios no briefing.' });
  }

  if (!UUID_REGEX.test(match_id)) {
    return res.status(400).json({ error: 'O match_id fornecido não é um UUID válido.' });
  }

  // Idempotência: evita re-análise se já existe resultado completo
  const reportPath = path.join(__dirname, 'analyses', `match_${match_id}_${player_id.replace('#', '_')}.json`);
  try {
    const content = await fs.promises.readFile(reportPath, 'utf8');
    const report = JSON.parse(content);
    if (report && report.conselho_kaio) {
      console.log(`[API] ♻️ Análise já concluída para ${match_id}. Ignorando re-processamento.`);
      return res.status(202).json({
        message: 'Análise já existente. Nenhum re-processamento necessário.',
        matchId: match_id,
        player: player_id
      });
    }
  } catch (_) {
    // Arquivo não existe ou inválido — segue para processar
  }

  console.log(`[API] Briefing recebido (Async): ${player_id} - ${match_id}`);

  // O processamento agora é feito EXCLUSIVAMENTE pelo startWorker() em background
  // para evitar o travamento do event loop do Node.js durante picos de requisições.
  await registerQueueJob(match_id, player_id);
  console.log(`📡 [QUEUE-SYNC] Job registrado no Admin: ${player_id}`);

  res.status(202).json({
    message: 'Briefing aceito e processamento iniciado em background.',
    matchId: match_id,
    player: player_id
  });
});

// Endpoint de Diagnóstico rápido para testar NAT/Firewall
app.get('/api/ping', (req, res) => {
    res.json({
        status: 'online',
        service: 'Oráculo-V Bridge',
        timestamp: new Date(),
        remote_ip: req.ip
    });
});

// Health Check completo com métricas de fila — ideal para monitoramento externo
app.get('/api/health', async (req, res) => {
    const health = {
        status: 'ok',
        service: 'Oráculo-V',
        timestamp: new Date().toISOString(),
        db: { oraculo: !!supabase, protocolo: !!supabaseProtocol },
        queue: null
    };

    if (supabaseProtocol) {
        try {
            const { data: jobs, error } = await supabaseProtocol
                .from('match_analysis_queue')
                .select('status')
                .order('created_at', { ascending: false })
                .limit(200);

            if (!error && jobs) {
                const counts = { pending: 0, processing: 0, completed: 0, failed: 0 };
                jobs.forEach(j => { if (counts[j.status] !== undefined) counts[j.status]++; });
                health.queue = counts;
                if (counts.failed > 10) health.status = 'degraded';
            }
        } catch (e) {
            health.queue = { error: e.message };
            health.status = 'degraded';
        }
    }

    const httpStatus = health.status === 'ok' ? 200 : 503;
    res.status(httpStatus).json(health);
});

/**
 * Endpoint Síncrono para Análise Imediata
 * Ideal para integrações diretas que aguardam o resultado (Protocolo-V)
 */
app.post('/api/analyze', async (req, res) => {
  const briefing = req.body;
  const { player_id, match_id } = briefing;

  if (!player_id || !match_id) {
    return res.status(400).json({ error: 'Player ID e Match ID são obrigatórios.' });
  }

  if (!UUID_REGEX.test(match_id)) {
    return res.status(400).json({ error: 'O match_id fornecido não é um UUID válido.' });
  }

  console.log(`[API] Requisição Síncrona /analyze: Match ${match_id} (Player: ${player_id})`);

  await registerQueueJob(match_id, player_id);

  try {
    const outcome = await processBriefing(briefing);

    if (outcome.success) {
      console.log(`✅ [API] Sucesso: Match ${match_id} (Player: ${player_id})`);
      res.status(200).json({
        status: 'completed',
        matchId: match_id,
        player: player_id,
        insight: outcome.insight,
        technical_data: outcome.result
      });
    } else {
      console.error(`❌ [API] Erro: Match ${match_id} (Player: ${player_id}):`, outcome.error);
      res.status(500).json({ 
        status: 'failed', 
        error: outcome.error || "Erro interno no processamento (vazio)"
      });
    }
  } catch (err) {
    console.error(`🔥 [API] Erro fatal em /analyze:`, err.message);
    res.status(500).json({ error: err.message || "Erro fatal interno" });
  }
});

app.get('/api/status/:matchId', async (req, res) => {
  const { matchId } = req.params;
  const player = req.query.player;

  if (!player) return res.status(400).json({ error: 'Player ID é obrigatório via query string (?player=...)' });

  try {
    // 1. Tentar primeiro o arquivo local (mais rápido e ignora discrepâncias de case no Windows)
    const reportPath = path.join(__dirname, 'analyses', `match_${matchId}_${player.replace('#', '_')}.json`);
    try {
      await fs.promises.access(reportPath); 
      const content = await fs.promises.readFile(reportPath, 'utf8');
      const result = JSON.parse(content);
      return res.json({ status: 'completed', result });
    } catch (pErr) {
      // Se o arquivo não existe, tenta o banco (pode ter sido gerado via Cloud/API sem arquivo local)
      
      // Busca diretamente na tabela de insights (usamos limit 1 para evitar erro de duplicidade)
      // ilike para lidar com OUSADIA#013 vs ousadia#013
      const { data: insights, error } = await supabase
        .from('ai_insights')
        .select('*')
        .eq('match_id', matchId)
        .ilike('player_id', player.replace('#', '%')) 
        .order('created_at', { ascending: false })
        .limit(1);

      const data = insights && insights.length > 0 ? insights[0] : null;

      if (error || !data) {
        if (error && error.code !== 'PGRST116') throw error;
        return res.status(404).json({ status: 'pending', message: 'Insight ainda não gerado ou partida não enviada.' });
      }

      // Tenta parsear o insight se ele for uma string JSON
      let tacticalInsight = data.insight_resumo;
      try {
          if (typeof tacticalInsight === 'string' && tacticalInsight.startsWith('{')) {
              tacticalInsight = JSON.parse(tacticalInsight);
          }
      } catch (e) {
          console.warn('[API] Falha ao parsear insight_resumo localmente.');
      }

      return res.json({ 
        status: 'completed', 
        result: { 
          agent: 'AGENTE',
          map: 'VALORANT',
          performance_index: data.impact_score || 0,
          performance_status: (data.impact_score || 0) >= 100 ? 'ABOVE_BASELINE' : 'BELOW_BASELINE',
          estimated_rank: data.classification || 'N/A',
          kd: 0,
          target_kd: 1.0,
          acs: 0,
          adr: 0,
          conselho_kaio: tacticalInsight,
          rounds: [] // Fallback sem timeline
        }
      });
    }

  } catch (err) {
    console.error('[API] Erro ao buscar status:', err.message);
    res.status(500).json({ error: 'Erro ao recuperar o status da análise.' });
  }
});

/**
 * Endpoint de Chat Direto com o Oráculo-V (Gemma3-Oraculo)
 * Utilizado para conversas táticas livres.
 */
app.post('/api/chat', adminAuth, async (req, res) => {
    const { messages, context } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Histórico de mensagens é obrigatório.' });
    }

    const localUrl = process.env.LOCAL_LLM_URL || 'http://localhost:11434';
    const localModel = process.env.LOCAL_LLM_MODEL || 'Gemma3-Oraculo';

    console.log(`💬 [CHAT] Iniciando sessão com ${localModel} para: ${context?.player_id || 'Visitante'}`);

    try {
        const tacticalDatabase = getGlobalStrategicSummary();
        
        // Construir System Prompt Dinâmico se houver contexto do jogador
        let systemPrompt = "VOCÊ É O K.A.I.O. (Kinetic Anti-Infrastructure Orchestrator), o mentor tático do Protocolo V.\n" +
                          "SEU MUNDO É O VALORANT, MAS O SEU CONHECIMENTO VEM EXCLUSIVAMENTE DA BASE ABAIXO.\n\n" +
                          "=== REGRA DE OURO ===\n" +
                          "1. SE O SEU CONHECIMENTO EXTRERNO CONFLITAR COM A BASE ABAIXO, VOCÊ DEVE IGNORAR O SEU CONHECIMENTO E USAR A BASE.\n" +
                          "2. EXEMPLO: SE O HARBOR ESTIVER COMO 'CONTROLADOR' NA BASE, ELE É UM CONTROLADOR. NUNCA O CHAME DE DUELISTA.\n" +
                          "3. AGENTES COMO Waylay, Veto, Tejo e Miks SÃO REAIS E FAZEM PARTE DO NOSSO PROTOCOLO.\n\n" +
                          "=== BASE DE DADOS ESTRATÉGICA ===\n\n" + tacticalDatabase + "\n\n" +
                          "=== DIRETRIZES DE RESPOSTA ===\n" +
                          "- Responda em Português-BR de forma clara, tática e sem clichês de IA.\n" +
                          "- NÃO responda em JSON no chat. Fale como um Professor ou Coach.\n" +
                          "- Seja curto, direto e focado em melhorar o jogo do recruta.";
        
        if (context) {
            systemPrompt += `\n\nCONTEXTO DO JOGADOR ATUAL:
            Agente: ${context.agent || 'Versatilidade'}
            Última Performance: ${context.impact_score || 'N/A'}/100
            Riot ID: ${context.player_id}
            Status Tático: ${context.rank || 'Em Avaliação'}`;
        }

        const ollamaMessages = [
            { role: 'system', content: systemPrompt },
            ...messages
        ];

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        const response = await fetch(`${localUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                model: localModel,
                messages: ollamaMessages,
                stream: false,
                options: {
                    temperature: 0.7, // Um pouco mais criativo para chat
                    num_ctx: 4096
                }
            })
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Erro no Ollama: ${response.statusText}`);
        }

        const data = await response.json();
        res.json({
            response: data.message?.content || "Desculpe, tive uma falha na rede neural.",
            model: localModel
        });

    } catch (err) {
        console.error('🔥 [CHAT-ERROR]:', err.message);
        res.status(500).json({ error: 'Falha ao conectar com o motor Gemma3-Oraculo: ' + err.message });
    }
});

app.get('/api/admin/stats', adminAuth, async (req, res) => {
  try {
    // 1. Busca as estatísticas REAIS de todos os registros (sem limite de 50)
    const { data: allJobs, error: countError } = await supabaseProtocol
      .from('match_analysis_queue')
      .select('status');

    if (countError) throw countError;

    // 2. Busca apenas os últimos 50 jobs para exibição na tabela (performance)
    const { data: jobs, error: jobsError } = await supabaseProtocol
      .from('match_analysis_queue')
      .select('*, operations(started_at)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (jobsError) throw jobsError;

    // 3. Busca o Total de Análises Concluídas no Histórico para o contador global
    const { count: historyCount, error: historyError } = await supabaseProtocol
      .from('ai_insights')
      .select('*', { count: 'exact', head: true });

    // 4. Busca contagem de Pendentes Táticos (Gaps de Squad)
    const { data: pendingSquads, error: pendingError } = await supabaseProtocol.rpc('get_pending_tactical_analyses');
    const pendingSquadsCount = pendingError ? 0 : (pendingSquads?.length || 0);

    const stats = {
      total: (historyCount || 0) + allJobs.length,
      pending: allJobs.filter(j => j.status === 'pending').length,
      processing: allJobs.filter(j => j.status === 'processing').length,
      failed: allJobs.filter(j => j.status === 'failed').length,
      pending_squads: pendingSquadsCount,
      queue_total: allJobs.length
    };

    res.json({
        stats,
        jobs: jobs.map(j => ({
            id: j.id,
            agente_tag: j.player_tag,
            match_id: j.match_id,
            status: j.status,
            created_at: j.created_at,
            match_date: j.operations?.started_at
        }))
    });
  } catch (err) {
    console.error('[API ADMIN] Erro:', err.message);
    res.status(500).json({ error: 'Erro interno ao recuperar estatísticas administrativas.' });
  }
});

/**
 * GET - Listar partidas em grupo sem análise pendente (Gap Tático)
 */
app.get('/api/admin/pending-squads', adminAuth, async (req, res) => {
  if (!supabaseProtocol) return res.status(503).json({ error: 'Serviço Protocolo-V indisponível' });

  try {
    // 1. Buscar squads de operações competitivas
    // 2. Filtrar as que não possuem insight na tabela ai_insights
    const { data: pending, error } = await supabaseProtocol.rpc('get_pending_tactical_analyses');

    if (error) {
      // Fallback manual silencioso (o RPC é opcional para performance)
      const { data: ops, error: opsError } = await supabaseProtocol
        .from('operation_squads')
        .select(`
          operation_id,
          riot_id,
          agent,
          operations (
            started_at,
            map_name,
            mode
          )
        `)
        .eq('operations.mode', 'Competitive')
        .order('operation_id', { ascending: false })
        .limit(1000); // Varrimento profundo

      if (opsError) throw opsError;

      // 1. Buscar IDs de matches únicos nas últimas 1000 operações
      const matchIds = [...new Set(ops.map(o => o.operation_id))];
      
      // 2. Buscar quem já tem Insight pronto
      const { data: insights } = await supabaseProtocol
        .from('ai_insights')
        .select('match_id, player_id')
        .in('match_id', matchIds);

      // 3. Buscar quem já está na Fila de Processamento
      const { data: queue } = await supabaseProtocol
        .from('match_analysis_queue')
        .select('match_id, player_tag')
        .in('match_id', matchIds);

      // Criar set de chaves "match_player" para exclusão rápida
      const excludeKeys = new Set([
          ...(insights?.map(i => `${i.match_id}_${i.player_id.toLowerCase().trim()}`) || []),
          ...(queue?.map(q => `${q.match_id}_${q.player_tag.toLowerCase().trim()}`) || [])
      ]);

      // Filtrar apenas o que falta de VERDADE (sem insight e fora da fila)
      // Ordena por data (started_at) ASC para que as análises sejam feitas na ordem cronológica correta
      const allTrueMissing = ops.filter(op => {
        const key = `${op.operation_id}_${op.riot_id.toLowerCase().trim()}`;
        return !excludeKeys.has(key);
      }).map(m => ({
        match_id: m.operation_id,
        player_tag: m.riot_id,
        agent: m.agent,
        started_at: m.operations?.started_at,
        map_name: m.operations?.map_name
      })).sort((a, b) => new Date(a.started_at) - new Date(b.started_at));

      return res.json({ total: allTrueMissing.length, missing: allTrueMissing.slice(0, 50) });
    }

    // Se o RPC retornou dados, garantir que respeitamos o limite de exibição e ordem cronológica
    const sortedPending = (pending || []).sort((a, b) => new Date(a.started_at) - new Date(b.started_at));
    res.json({ total: sortedPending.length, missing: sortedPending.slice(0, 50) });
  } catch (err) {
    console.error('[API ADMIN PENDING] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao listar pendências: ' + err.message });
  }
});



// POST - Reprocessar em Lote (Bulk)
app.post('/api/admin/reprocess/bulk', adminAuth, async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Lista de items inválida para reprocessamento.' });
    }

    console.log(`🚀 [ADMIN] Enfileirando ${items.length} análises para processamento síncrono...`);

    // Fazemos o processamento de forma sequencial ou paralela (com limite se necessário)
    // Para simplificar, vamos disparar em background e retornar 202
    for (const item of items) {
       registerQueueJob(item.match_id, item.player_tag, 'pending');
    }

    res.json({
      success: true,
      message: `${items.length} análises foram adicionadas à fila de processamento.`,
      added: items.length
    });

  } catch (err) {
    console.error('[API ADMIN BULK] Erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET - Histórico de todas as análises (com suporte a filtro e busca)
app.get('/api/admin/history', adminAuth, async (req, res) => {
  try {
    const { search, date, sortBy, order } = req.query;

    // Buscamos os insights junto com a data real da partida (JOIN com operations)
    // Usamos !inner se houver filtro de data para garantir que o filtro remova a linha do insight
    const joinType = date ? 'operations!inner(started_at)' : 'operations(started_at)';
    
    let query = supabaseProtocol
      .from('ai_insights')
      .select(`id, player_id, match_id, created_at, impact_score, ${joinType}`, { count: 'exact' });

    // Filtro por Busca (Player ID ou Match ID)
    if (search) {
      if (UUID_REGEX.test(search)) {
        query = query.or(`player_id.ilike.%${search}%,match_id.eq.${search}`);
      } else {
        query = query.ilike('player_id', `%${search}%`);
      }
    }

    // Filtro por Data Real da Partida (started_at é BigInt/Number Epoch MS no banco)
    if (date) {
      // Definir início e fim do dia em UTC para comparação numérica
      const startOfDay = new Date(`${date}T00:00:00Z`).getTime();
      const endOfDay = new Date(`${date}T23:59:59.999Z`).getTime();
      
      console.log(`[API] Filtrando partidas entre: ${startOfDay} e ${endOfDay} (Data: ${date})`);
      
      // Filtrando no JOIN (com !inner acima)
      query = query.gte('operations.started_at', startOfDay).lte('operations.started_at', endOfDay);
    }

    // Ordenação
    const sortCol = sortBy === 'score' ? 'impact_score' : 'created_at';
    const sortOrder = order === 'asc';
    query = query.order(sortCol, { ascending: sortOrder });

    // Limite de performance
    const { data: analyses, error, count: totalCount } = await query.limit(200);

    if (error) {
      console.error('[API ADMIN HISTORY] Query Error:', error);
      throw error;
    }

    // Processar resultados
    const results = (analyses || []).map(a => ({
      id: a.id,
      agente_tag: a.player_id,
      match_id: a.match_id,
      created_at: a.created_at,
      match_date: a.operations?.started_at,
      impact_score: a.impact_score || '--'
    }));

    res.json({
      total: totalCount || results.length,
      analyses: results
    });
  } catch (err) {
    console.error('[API ADMIN HISTORY] Erro:', err.message);
    res.status(500).json({ error: 'Erro interno ao recuperar histórico: ' + err.message });
  }
});

// DELETE - Apagar uma análise
app.delete('/api/admin/analysis', adminAuth, async (req, res) => {
  try {
    const { match_id, player_id } = req.body;

    if (!match_id || !player_id) {
      return res.status(400).json({ error: 'match_id e player_id são obrigatórios' });
    }

    console.log(`🗑️ [ADMIN] Deletando análise: ${player_id} | ${match_id}`);

    // Apagar de ai_insights (Oráculo)
    if (supabase) {
      await supabase
        .from('ai_insights')
        .delete()
        .eq('match_id', match_id)
        .ilike('player_id', player_id);
    }

    // Apagar de ai_insights (Protocolo-V)
    if (supabaseProtocol) {
      await supabaseProtocol
        .from('ai_insights')
        .delete()
        .eq('match_id', match_id)
        .ilike('player_id', player_id);
    }

    // Apagar arquivo local
    const localPath = path.join(__dirname, 'analyses', `match_${match_id}_${player_id.replace('#', '_')}.json`);
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
      console.log(`📂 Arquivo local deletado: ${localPath}`);
    }

    res.json({
      success: true,
      message: `Análise deletada: ${player_id} | ${match_id}`
    });

  } catch (err) {
    console.error('[API ADMIN DELETE] Erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE - Apagar TODAS as análises
app.delete('/api/admin/analysis/all', adminAuth, async (req, res) => {
  try {
    console.log(`🗑️ [ADMIN] APAGANDO TODAS AS ANÁLISES`);

    let deletedCount = 0;

    // Apagar de ai_insights (Oráculo)
    if (supabase) {
      const { count: oracCount } = await supabase
        .from('ai_insights')
        .delete({ count: 'exact' })
        .neq('id', '00000000-0000-0000-0000-000000000000');
      deletedCount += oracCount || 0;
    }

    // Apagar de ai_insights (Protocolo-V)
    if (supabaseProtocol) {
      const { count: protoCount } = await supabaseProtocol
        .from('ai_insights')
        .delete({ count: 'exact' })
        .neq('id', '00000000-0000-0000-0000-000000000000');
      deletedCount += protoCount || 0;
    }

    // Apagar todos os arquivos locais
    const analysesDir = path.join(__dirname, 'analyses');
    if (fs.existsSync(analysesDir)) {
      const files = fs.readdirSync(analysesDir);
      files.forEach(file => {
        const filePath = path.join(analysesDir, file);
        if (file.endsWith('.json')) {
          fs.unlinkSync(filePath);
        }
      });
      console.log(`📂 ${files.length} arquivos locais deletados`);
    }

    res.json({
      success: true,
      message: `Todas as análises foram apagadas`,
      deleted_count: deletedCount,
      local_files_deleted: fs.existsSync(analysesDir) ? fs.readdirSync(analysesDir).length : 0
    });

  } catch (err) {
    console.error('[API ADMIN DELETE ALL] Erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST - Reprocessar uma análise
app.post('/api/admin/reprocess', adminAuth, async (req, res) => {
  try {
    const { match_id, player_id } = req.body;

    if (!match_id || !player_id) {
      return res.status(400).json({ error: 'match_id e player_id são obrigatórios' });
    }

    // O processamento detalhado agora é logado apenas pelo worker.js

    // Apagar análise anterior
    if (supabase) {
      await supabase
        .from('ai_insights')
        .delete()
        .eq('match_id', match_id)
        .ilike('player_id', player_id);
    }

    if (supabaseProtocol) {
      await supabaseProtocol
        .from('ai_insights')
        .delete()
        .eq('match_id', match_id)
        .ilike('player_id', player_id);
    }

    // Apagar arquivo local
    const localPath = path.join(__dirname, 'analyses', `match_${match_id}_${player_id.replace('#', '_')}.json`);
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }

    // Reprocessar
    const { processBriefing } = await import('./worker.js');
    const result = await processBriefing({
      match_id,
      player_id,
      map_name: null,
      agent_name: null,
      raw_data: null,
      ability_context: [],
      squad_stats: null
    });

    if (result.success) {
      res.json({
        success: true,
        message: 'Análise reprocessada com sucesso',
        rank: result.insight.rank,
        score: result.insight.score
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (err) {
    console.error('[API ADMIN REPROCESS] Erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST - Sincronizar TODAS as pendências (Gap Tático) diretamente no servidor
app.post('/api/admin/queue/sync-all', adminAuth, async (req, res) => {
  if (!supabaseProtocol) return res.status(503).json({ error: 'Serviço Protocolo-V indisponível' });

  try {
    console.log('🚀 [ADMIN] Iniciando sincronização GLOBAL de pendências...');

    // 1. Buscar a lista real de quem falta ser analisado (sem limite de 50)
    let pendingItems = [];
    const { data: rpcPending, error: rpcError } = await supabaseProtocol.rpc('get_pending_tactical_analyses');

    if (rpcError) {
      console.warn('⚠️ RPC falhou, usando fallback manual para busca global...');
      const { data: ops } = await supabaseProtocol
        .from('operation_squads')
        .select('operation_id, riot_id, operations(started_at)')
        .eq('operations.mode', 'Competitive');

      const { data: insights } = await supabaseProtocol.from('ai_insights').select('match_id, player_id');
      const { data: queue } = await supabaseProtocol.from('match_analysis_queue').select('match_id, player_tag');

      const excludeKeys = new Set([
        ...(insights?.map(i => `${i.match_id}_${i.player_id.toLowerCase().trim()}`) || []),
        ...(queue?.map(q => `${q.match_id}_${q.player_tag.toLowerCase().trim()}`) || [])
      ]);

      pendingItems = ops.filter(op => {
        const key = `${op.operation_id}_${op.riot_id.toLowerCase().trim()}`;
        return !excludeKeys.has(key);
      }).map(m => ({ match_id: m.operation_id, player_tag: m.riot_id, started_at: m.operations?.started_at }));
    } else {
      pendingItems = rpcPending || [];
    }

    if (pendingItems.length === 0) {
      return res.json({ success: true, message: 'Nenhuma nova pendência encontrada.', added: 0 });
    }

    console.log(`📦 Encontradas ${pendingItems.length} pendências. Enfileirando cronologicamente...`);

    // 2. Ordenar por data para processar da mais antiga para a mais nova
    const sorted = pendingItems.sort((a, b) => new Date(a.started_at) - new Date(b.started_at));

    const startTime = Date.now();
    const queueItems = sorted.map((item, index) => ({
      match_id: item.match_id,
      player_tag: item.player_tag,
      status: 'pending',
      created_at: new Date(startTime + index).toISOString() // microssegundos de diferença para preservar ordem
    }));

    // 3. Inserir em lotes de 100 para evitar timeout do Supabase
    const BATCH_SIZE = 100;
    let addedCount = 0;
    for (let i = 0; i < queueItems.length; i += BATCH_SIZE) {
      const batch = queueItems.slice(i, i + BATCH_SIZE);
      const { error } = await supabaseProtocol
        .from('match_analysis_queue')
        .upsert(batch, { onConflict: 'match_id, player_tag' });
      
      if (error) throw error;
      addedCount += batch.length;
      console.log(`✅ Lote enfileirado: ${addedCount}/${queueItems.length}`);
    }

    res.json({
      success: true,
      message: `${addedCount} análises enfileiradas com sucesso.`,
      total_in_queue: addedCount
    });

  } catch (err) {
    console.error('[API ADMIN SYNC-ALL] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao sincronizar pendências: ' + err.message });
  }
});

// --- CONFIGURAÇÃO TÁTICA E PARAMETRIZAÇÃO ---
app.get('/api/admin/config', adminAuth, async (req, res) => {
    try {
        const { data: roles } = await supabase.from('tactical_roles_config').select('*').order('role');
        const { data: globals } = await supabase.from('global_tactical_config').select('*').order('key');
        
        res.json({ roles, globals });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/config/role', adminAuth, async (req, res) => {
    try {
        const { role, ...updates } = req.body;
        if (!role) return res.status(400).json({ error: 'Role é obrigatório' });

        const { error } = await supabase
            .from('tactical_roles_config')
            .update({ ...updates, updated_at: new Date() })
            .eq('role', role);

        if (error) throw error;
        res.json({ success: true, message: `Configuração de ${role} atualizada.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/config/global', adminAuth, async (req, res) => {
    try {
        const { key, value } = req.body;
        if (!key) return res.status(400).json({ error: 'Chave é obrigatória' });

        const { error } = await supabase
            .from('global_tactical_config')
            .update({ value, updated_at: new Date() })
            .eq('key', key);

        if (error) throw error;
        res.json({ success: true, message: `Configuração global ${key} atualizada.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── TRIBUNAL TÁTICO — Endpoints Admin ──────────────────────────────────────

// GET /api/admin/tribunal/knowledge — Lista padrões aprendidos pelo Árbitro
app.get('/api/admin/tribunal/knowledge', adminAuth, async (req, res) => {
    try {
        const { pattern_type, min_confidence, limit: queryLimit } = req.query;
        let query = supabase
            .from('arbiter_knowledge')
            .select('*')
            .order('confidence', { ascending: false })
            .limit(parseInt(queryLimit) || 50);

        if (pattern_type) query = query.eq('pattern_type', pattern_type);
        if (min_confidence) query = query.gte('confidence', parseFloat(min_confidence));

        const { data, error } = await query;
        if (error) throw error;

        // Estatísticas agregadas
        const stats = {
            total_patterns: data.length,
            by_type: {},
            avg_confidence: 0
        };
        for (const p of data) {
            stats.by_type[p.pattern_type] = (stats.by_type[p.pattern_type] || 0) + 1;
            stats.avg_confidence += p.confidence;
        }
        stats.avg_confidence = data.length > 0 ? Math.round((stats.avg_confidence / data.length) * 100) / 100 : 0;

        res.json({ stats, patterns: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/admin/tribunal/verdicts — Histórico de vereditos
app.get('/api/admin/tribunal/verdicts', adminAuth, async (req, res) => {
    try {
        const { player_id, limit: queryLimit } = req.query;
        let query = supabase
            .from('tribunal_verdicts')
            .select('id, match_id, player_id, winning_persona, advocate_model, prosecutor_model, arbiter_model, patterns_learned, created_at')
            .order('created_at', { ascending: false })
            .limit(parseInt(queryLimit) || 30);

        if (player_id) query = query.ilike('player_id', `%${player_id}%`);

        const { data, error } = await query;
        if (error) throw error;

        res.json({ count: data.length, verdicts: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/admin/tribunal/verdict/:matchId — Veredito completo de uma partida
app.get('/api/admin/tribunal/verdict/:matchId', adminAuth, async (req, res) => {
    try {
        const { matchId } = req.params;
        const { player_id } = req.query;

        let query = supabase
            .from('tribunal_verdicts')
            .select('*')
            .eq('match_id', matchId);

        if (player_id) query = query.ilike('player_id', `%${player_id}%`);

        const { data, error } = await query;
        if (error) throw error;

        if (!data || data.length === 0) {
            return res.status(404).json({ error: 'Veredito não encontrado.' });
        }

        res.json(data.length === 1 ? data[0] : data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/admin/tribunal/knowledge/:id — Remove um padrão da base
app.delete('/api/admin/tribunal/knowledge/:id', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('arbiter_knowledge')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true, message: 'Padrão removido.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── FIM — TRIBUNAL ──────────────────────────────────────────────────────────

if (process.env.NODE_ENV && process.env.NODE_ENV.trim() === 'test') {
  // Em modo de teste, o supertest gerencia o servidor.
} else {
  // Explicitamente escutando em 0.0.0.0 para aceitar conexões externas (NAT)
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Oráculo-V Bridge ATIVA em todas as interfaces na porta ${PORT}`);
    console.log(`🔗 Verificação Local:   http://localhost:${PORT}/api/ping`);
    console.log(`🔗 Verificação Externa: http://${process.env.EXTERNAL_IP || '191.180.122.186'}:${PORT}/api/ping`);
    
    console.log('\n--- SUPABASE CLIENT STATUS ---');
    console.log('Oráculo Client:', !!supabase);
    console.log('Protocol Client:', !!supabaseProtocol);
    if (!supabaseProtocol) {
      console.warn('⚠️ supabaseProtocol is NULL in server.js');
    }
    console.log('------------------------------');

    // Inicia o motor de processamento da fila em background
    startWorker().catch(err => console.error('[WORKER] Erro na inicialização:', err.message));
  });
}

// Fallback para rotas não encontradas - importante para evitar "Unexpected token <" no frontend
app.use((req, res) => {
    res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.url}` });
});

export default app;
