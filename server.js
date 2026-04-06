import express from 'express';
import { runAnalysis } from './analyze_match.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getKnownAgents, getGlobalStrategicSummary } from './lib/tactical_knowledge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Core Database Connection (O Oráculo agora é Soberano de seus próprios dados)
import { supabase } from './lib/supabase.js';

const app = express();
const PORT = process.env.PORT || 3001;

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// Servir Protocolo-V docs (se existir)
const protocolovDocsPath = path.join(__dirname, '../protocolov/docs');
if (fs.existsSync(protocolovDocsPath)) {
  app.use('/protocol', express.static(protocolovDocsPath));
}

import { processBriefing, startWorker } from './worker.js';

async function registerQueueJob(match_id, player_id, status = 'pending') {
    if (!supabase) return;
    try {
        const { data: existing } = await supabase
            .from('match_analysis_queue')
            .select('id')
            .eq('match_id', match_id)
            .eq('player_tag', player_id)
            .limit(1);

        if (existing && existing.length > 0) {
            if (status === 'pending') {
              await supabase.from('match_analysis_queue')
                  .update({ status, created_at: new Date().toISOString(), retry_count: 0 })
                  .eq('id', existing[0].id);
            }
            return;
        }

        await supabase.from('match_analysis_queue').insert([{
            match_id,
            player_tag: player_id,
            status,
            created_at: new Date().toISOString()
        }]);
    } catch (err) {
        console.warn(`⚠️ [QUEUE] Falha ao registrar job local: ${err.message}`);
    }
}

// Middleware de Segurança
const adminAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const masterKey = process.env.ADMIN_API_KEY;
  if (!apiKey && req.hostname === 'localhost') return next();
  if (!masterKey) return res.status(500).json({ error: 'Configuração de segurança pendente.' });
  if (apiKey !== masterKey) return res.status(401).json({ error: 'Acesso negado.' });
  next();
};

/**
 * Endpoint de Ingestão: Recebe jobs e joga na fila local.
 */
app.post('/api/queue', adminAuth, async (req, res) => {
  const briefing = req.body;
  const { player_id, match_id } = briefing;

  if (!player_id || !match_id) return res.status(400).json({ error: 'Player ID e Match ID são obrigatórios.' });
  if (!UUID_REGEX.test(match_id)) return res.status(400).json({ error: 'ID de partida inválido.' });

  console.log(`[API] Job recebido: ${player_id} - ${match_id}`);
  await registerQueueJob(match_id, player_id);

  res.status(202).json({
    message: 'Job enfileirado no Oráculo-V.',
    matchId: match_id,
    player: player_id
  });
});

app.get('/api/ping', (req, res) => res.json({ status: 'online', service: 'Oráculo-V Bridge', timestamp: new Date() }));

app.get('/api/health', async (req, res) => {
    const { count: pending } = await supabase.from('match_analysis_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending');
    res.json({
        status: 'ok',
        service: 'Oráculo-V',
        db: { connected: !!supabase },
        queue: { pending: pending || 0 }
    });
});

/**
 * Análise Síncrona (Apenas para debug ou casos críticos)
 */
app.post('/api/analyze', adminAuth, async (req, res) => {
  const briefing = req.body;
  const { player_id, match_id } = briefing;

  try {
    const outcome = await processBriefing(briefing);
    if (outcome.success) {
      res.json({ status: 'completed', matchId: match_id, player: player_id, insight: outcome.insight });
    } else {
      res.status(500).json({ status: 'failed', error: outcome.error });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/status/:matchId', async (req, res) => {
  const { matchId } = req.params;
  const player = req.query.player;
  if (!player) return res.status(400).json({ error: 'Player ID obrigatório.' });

  try {
    const reportPath = path.join(__dirname, 'analyses', `match_${matchId}_${player.replace('#', '_')}.json`);
    if (fs.existsSync(reportPath)) {
      const content = await fs.promises.readFile(reportPath, 'utf8');
      return res.json({ status: 'completed', result: JSON.parse(content) });
    }
    
    // Se não houver arquivo, tenta o banco local
    const { data: insight } = await supabase
        .from('ai_insights')
        .select('*')
        .eq('match_id', matchId)
        .ilike('player_id', player.replace('#', '%'))
        .maybeSingle();

    if (insight) {
        return res.json({ status: 'completed', result: { performance_index: insight.impact_score } });
    }

    res.status(404).json({ status: 'pending' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chat', adminAuth, async (req, res) => {
    const { messages, context } = req.body;
    const localUrl = process.env.LOCAL_LLM_URL || 'http://localhost:11434';
    const localModel = process.env.LOCAL_LLM_MODEL || 'Gemma3-Oraculo';

    try {
        const tacticalDatabase = getGlobalStrategicSummary();
        let systemPrompt = "VOCÊ É O K.A.I.O. (Kinetic Anti-Infrastructure Orchestrator), mentor tático do Protocolo V.\n\n" + 
                           "BASE TÁTICA:\n" + tacticalDatabase;
        
        const response = await fetch(`${localUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: localModel,
                messages: [{ role: 'system', content: systemPrompt }, ...messages],
                stream: false
            })
        });

        const data = await response.json();
        res.json({ response: data.message?.content, model: localModel });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`🌐 [ORACULO-V] Servidor ativo em http://localhost:${PORT}`);
    startWorker();
});
