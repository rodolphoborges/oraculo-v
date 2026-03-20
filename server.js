import express from 'express';
import { runAnalysis } from './analyze_match.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

app.post('/api/analyze', async (req, res) => {
  const { player, matchId } = req.body;

  if (!player || !matchId) {
    return res.status(400).json({ error: 'Player Tag e Match ID são obrigatórios.' });
  }

  try {
    console.log(`Iniciando análise para ${player} - Partida ${matchId}...`);
    const result = await runAnalysis(player, matchId);
    res.json(result);
  } catch (err) {
    console.error('Erro na análise:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Oráculo V Dashboard rodando em http://localhost:${PORT}`);
});
