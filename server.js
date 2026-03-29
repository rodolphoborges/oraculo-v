import express from 'express';
import { runAnalysis } from './analyze_match.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Core Database Connection
import { supabase } from './lib/supabase.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

import { processBriefing } from './worker.js';

// Middleware de Segurança para Rotas Administrativas
const adminAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const masterKey = process.env.ADMIN_API_KEY;

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

  console.log(`[API] Briefing recebido (Async): ${player_id} - ${match_id}`);

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

  console.log(`[API] Requisição Síncrona /analyze: Match ${match_id} (Player: ${player_id})`);

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
    // Busca diretamente na tabela de insights
    const { data, error } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('match_id', matchId)
      .eq('player_id', player)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // Not found
         return res.status(404).json({ status: 'pending', message: 'Insight ainda não gerado ou partida não enviada.' });
      }
      throw error;
    }

    // Se encontramos no banco, verificamos se temos o JSON local para o relatório completo
    const reportPath = path.join(__dirname, 'analyses', `match_${matchId}_${player.replace('#', '_')}.json`);
    try {
      await fs.promises.access(reportPath); 
      const content = await fs.promises.readFile(reportPath, 'utf8');
      const result = JSON.parse(content);
      return res.json({ status: 'completed', result });
    } catch (pErr) {
      // Se não houver arquivo local, retornamos o insight do banco como fallback
      console.log(`[API] Relatório local não encontrado. Fornecendo insight resumido.`);
      return res.json({ 
        status: 'completed', 
        result: { 
          insight: data.insight_resumo,
          model: data.model_used,
          created_at: data.created_at
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
    const { data: insights, error, count } = await supabase
      .from('ai_insights')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(0, 49);

    if (error) throw error;

    res.json({ 
        total_records: count,
        last_insights: insights 
    });
  } catch (err) {
    console.error('[API ADMIN] Erro:', err.message);
    res.status(500).json({ error: 'Erro interno ao recuperar estatísticas administrativas.' });
  }
});

app.listen(PORT, () => {
  console.log(`Oráculo V Dashboard rodando em http://localhost:${PORT}`);
});
