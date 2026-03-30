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

import { processBriefing, startWorker } from './worker.js';

// Middleware de Segurança para Rotas Administrativas
const adminAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const masterKey = process.env.ADMIN_API_KEY;

  // Permitir acesso local (Dashboard) sem chave
  const isLocal = req.hostname === 'localhost' || req.hostname === '127.0.0.1';
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

  // Registrar na fila do Protocolo-V para visibilidade no monitor Admin
  if (supabaseProtocol) {
    try {
      await supabaseProtocol.from('match_analysis_queue').upsert([{
        match_id,
        player_tag: player_id,
        status: 'processing',
        created_at: new Date().toISOString()
      }], { onConflict: 'match_id, player_tag' });
      console.log(`📡 [QUEUE-SYNC] Job registrado no Admin: ${player_id}`);
    } catch (err) {
      console.warn(`⚠️ [QUEUE-SYNC] Falha ao registrar no Admin: ${err.message}`);
    }
  }

  // Disparar processamento em background (202 Accepted)
  processBriefing(briefing)
    .catch(err => console.error(`[ENGINE] Falha crítica no processamento de ${match_id}:`, err.message));

  res.status(202).json({
    message: 'Briefing aceito e processamento iniciado em background.',
    matchId: match_id,
    player: player_id
  });
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

  // Registrar na fila do Protocolo-V para visibilidade no monitor Admin
  if (supabaseProtocol) {
    try {
      await supabaseProtocol.from('match_analysis_queue').upsert([{
        match_id,
        player_tag: player_id,
        status: 'processing',
        created_at: new Date().toISOString()
      }], { onConflict: 'match_id, player_tag' });
    } catch (err) {
      console.warn(`⚠️ [QUEUE-SYNC] Falha ao registrar no Admin: ${err.message}`);
    }
  }

  try {
    // Timeout de segurança no servidor express se desejar, mas vamos aguardar o processamento
    const outcome = await processBriefing(briefing);

    if (outcome.success) {
      res.status(200).json({
        status: 'completed',
        matchId: match_id,
        player: player_id,
        insight: outcome.insight,
        technical_data: outcome.result
      });
    } else {
      res.status(500).json({ 
        status: 'failed', 
        error: outcome.error 
      });
    }
  } catch (err) {
    console.error('[API] Erro síncrono fatal:', err.message);
    res.status(500).json({ error: 'Ocorreu um erro interno durante a análise em tempo real.' });
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
    // Busca os últimos 50 itens da fila (match_analysis_queue) no Protocolo-V
    const { data: jobs, error } = await supabaseProtocol
      .from('match_analysis_queue')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    // Calcular estatísticas agregadas
    const stats = {
      total: jobs.length,
      pending: jobs.filter(j => j.status === 'pending').length,
      processing: jobs.filter(j => j.status === 'processing').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length
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

if (process.env.NODE_ENV && process.env.NODE_ENV.trim() === 'test') {
  // Em modo de teste, o supertest gerencia o servidor.
} else {
  app.listen(PORT, () => {
    console.log(`Oráculo V Dashboard rodando em http://localhost:${PORT}`);
    console.log('--- SUPABASE CLIENT STATUS ---');
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
