import express from 'express';
import { runAnalysis } from './analyze_match.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Core Database Connection
import { supabase, supabaseProtocol } from './lib/supabase.js';

const app = express();
const PORT = process.env.PORT || 3000;

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

  await registerQueueJob(match_id, player_id);
  console.log(`📡 [QUEUE-SYNC] Job registrado no Admin: ${player_id}`);

  // Disparar processamento em background (202 Accepted)
  processBriefing(briefing)
    .catch(err => console.error(`[ENGINE] Falha crítica no processamento de ${match_id}:`, err.message));

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
      .select('*')
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
            created_at: j.created_at
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
        .limit(100);

      if (opsError) throw opsError;

      // Pegar todos os IDs de matches das ops encontradas
      const matchIds = [...new Set(ops.map(o => o.operation_id))];
      
      // Buscar quais já tem insight
      const { data: insights } = await supabaseProtocol
        .from('ai_insights')
        .select('match_id, player_id')
        .in('match_id', matchIds);

      const analyzedKeys = new Set(insights?.map(i => `${i.match_id}_${i.player_id.toLowerCase()}`) || []);

      // Filtrar apenas o que falta
      const missing = ops.filter(op => {
        const key = `${op.operation_id}_${op.riot_id.toLowerCase()}`;
        return !analyzedKeys.has(key);
      }).map(m => ({
        match_id: m.operation_id,
        player_tag: m.riot_id,
        agent: m.agent,
        started_at: m.operations?.started_at,
        map_name: m.operations?.map_name
      })).slice(0, 50);

      return res.json({ total: missing.length, missing });
    }

    res.json({ total: pending.length, missing: pending });

  } catch (err) {
    console.error('[API ADMIN PENDING] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao listar pendências: ' + err.message });
  }
});

// GET - Estatísticas Consolidadas para o Dashboard Admin
app.get('/api/admin/stats', adminAuth, async (req, res) => {
  try {
    const stats = { pending: 0, processing: 0, completed: 0, failed: 0 };
    let jobs = [];

    if (supabaseProtocol) {
      // 1. Contagem rápida por status
      const { data: counts } = await supabaseProtocol
        .from('match_analysis_queue')
        .select('status');
      
      if (counts) {
        counts.forEach(c => { if (stats[c.status] !== undefined) stats[c.status]++; });
      }

      // 2. Contagem de concluídos no Protocolo-V
      const { count: completedCount } = await supabaseProtocol
        .from('ai_insights')
        .select('*', { count: 'exact', head: true });
      stats.completed = completedCount || 0;

      // 3. Buscar os jobs mais recentes (Últimos 50)
      const { data: queueJobs } = await supabaseProtocol
        .from('match_analysis_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      jobs = queueJobs || [];
    }

    res.json({
      success: true,
      stats,
      jobs: jobs.map(j => ({
        player_tag: j.player_tag,
        match_id: j.match_id,
        status: j.status,
        retry_count: j.retry_count,
        created_at: j.created_at
      }))
    });
  } catch (err) {
    console.error('[API ADMIN STATS] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao consolidar estatísticas.' });
  }
});

// GET - Histórico de todas as análises
app.get('/api/admin/history', adminAuth, async (req, res) => {
  try {
    // Buscar de Protocolo-V (onde as análises são sincronizadas)
    const { data: analyses, error } = await supabaseProtocol
      .from('ai_insights')
      .select('id, player_id, match_id, created_at, impact_score')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[API ADMIN HISTORY] Erro na query:', error);
      throw error;
    }

    res.json({
      total: analyses.length,
      analyses: analyses.map(a => ({
        id: a.id,
        agente_tag: a.player_id,
        match_id: a.match_id,
        created_at: a.created_at,
        impact_score: a.impact_score || '--'
      }))
    });
  } catch (err) {
    console.error('[API ADMIN HISTORY] Erro:', err.message);
    res.status(500).json({ error: 'Erro interno ao recuperar histórico.' });
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

export default app;
