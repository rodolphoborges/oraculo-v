import express from 'express';
import { runAnalysis } from './analyze_match.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

import { supabase } from './lib/supabase.js';

app.post('/api/queue', async (req, res) => {
  const { player, matchId } = req.body;

  if (!player || !matchId) {
    return res.status(400).json({ error: 'Player Tag e Match ID são obrigatórios.' });
  }

  try {
    console.log(`[API] Enfileirando análise: ${player} - ${matchId}`);
    
    // Verifica se já existe na fila para evitar duplicatas pendentes
    const { data: existing } = await supabase
      .from('match_analysis_queue')
      .select('id, status')
      .eq('match_id', matchId)
      .eq('player_tag', player)
      .neq('status', 'failed')
      .limit(1);

    if (existing && existing.length > 0) {
      return res.json({ jobId: existing[0].id, status: existing[0].status, message: 'Já está na fila.' });
    }

    const { data, error } = await supabase
      .from('match_analysis_queue')
      .insert([{ 
        match_id: matchId, 
        player_tag: player, 
        status: 'pending' 
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ jobId: data.id, status: 'pending' });
  } catch (err) {
    console.error('[API] Erro ao enfileirar:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/status/:matchId', async (req, res) => {
  const { matchId } = req.params;
  const player = req.query.player;

  try {
    let query = supabase
      .from('match_analysis_queue')
      .select('*')
      .eq('match_id', matchId);
    
    if (player) {
      query = query.eq('player_tag', player);
    }

    const { data, error } = await query.order('created_at', { ascending: false }).limit(1);

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Análise não encontrada na fila.' });
    }

    const job = data[0];
    
    // Se estiver completo, tentamos carregar o JSON do relatório local
    if (job.status === 'completed') {
      const reportPath = `analysis_${job.player_tag.replace('#', '_')}.json`;
      if (fs.existsSync(reportPath)) {
        const result = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        return res.json({ status: 'completed', result });
      }
    }

    res.json({ 
      status: job.status, 
      error: job.error_msg,
      processed_at: job.processed_at 
    });
  } catch (err) {
    console.error('[API] Erro ao buscar status:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/stats', async (req, res) => {
  try {
    // Busca os últimos 50 jobs
    const { data: jobs, error: jError } = await supabase
      .from('match_analysis_queue')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (jError) throw jError;

    // Calcula estatísticas básicas
    const stats = {
      total: jobs.length,
      pending: jobs.filter(j => j.status === 'pending').length,
      processing: jobs.filter(j => j.status === 'processing').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
    };

    res.json({ stats, jobs });
  } catch (err) {
    console.error('[API ADMIN] Erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Oráculo V Dashboard rodando em http://localhost:${PORT}`);
});
