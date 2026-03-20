import { getAgentMeta } from './lib/meta_loader.js';
import { fetchMatchJson } from './lib/tracker_api.js';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export async function runAnalysis(playerTag, inputPath, mapName = 'ALL', rank = 'ALL') {
  let matchJsonPath = inputPath;

  // 1. Verifica se o input é um Match ID (UUID)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inputPath);
  
  if (isUuid) {
    const matchesDir = './matches';
    if (!fs.existsSync(matchesDir)) fs.mkdirSync(matchesDir);
    
    matchJsonPath = path.join(matchesDir, `${inputPath}.json`);
    
    if (!fs.existsSync(matchJsonPath)) {
      console.log(`Match ID detectado. Baixando dados para ${matchJsonPath}...`);
      try {
        const data = await fetchMatchJson(inputPath);
        fs.writeFileSync(matchJsonPath, JSON.stringify(data, null, 2));
      } catch (err) {
        throw new Error(`Falha ao baixar dados da partida: ${err.message}`);
      }
    }
  }

  if (!fs.existsSync(matchJsonPath)) {
    throw new Error(`Arquivo ${matchJsonPath} não encontrado.`);
  }

  // 2. Carrega o JSON da partida
  const matchData = JSON.parse(fs.readFileSync(matchJsonPath, 'utf8'));
  
  // 3. Identifica o agente do jogador na partida
  const playerSegments = matchData.data.segments.filter(s => s.type === 'player');
  const playerData = playerSegments.find(p => p.attributes.platformUserIdentifier.toUpperCase() === playerTag.toUpperCase());
  
  let agentName = playerData ? playerData.metadata.agentName : null;
  
  if (!agentName) {
    const playerRound = matchData.data.segments.find(s => s.type === 'player-round' && s.attributes.platformUserIdentifier.toUpperCase() === playerTag.toUpperCase());
    agentName = playerRound ? playerRound.metadata.agentName : null;
  }

  if (!agentName) {
    throw new Error('Jogador não encontrado na partida.');
  }

  const mapDetected = matchData.data.metadata.mapName;

  // 4. Busca o Meta Baseline
  const meta = await getAgentMeta(agentName, mapName, rank);
  const targetKd = meta ? meta.kd : 1.0;

  // 5. Chama o script Python
  try {
    const cmd = `python /tmp/analyze_valorant.py --json "${matchJsonPath}" --player "${playerTag}" --target-kd ${targetKd}`;
    const result = execSync(cmd, { encoding: 'utf8' });
    
    const analysisResult = JSON.parse(result);
    
    // Salva o relatório local
    const finalReportPath = `analysis_${playerTag.replace('#', '_')}.json`;
    fs.writeFileSync(finalReportPath, result, 'utf8');
    
    return analysisResult;
  } catch (err) {
    throw new Error(`Erro ao executar análise Python: ${err.message}`);
  }
}

// CLI handling - Only run if main
if (process.argv[1].endsWith('analyze_match.js')) {
  const args = process.argv.slice(2);
  const player = args[0] || 'OUSADIA#013';
  const input = args[1];

  if (!input) {
    console.log('Uso: node analyze_match.js <PLAYER#TAG> <MATCH_ID|JSON_PATH>');
    process.exit(1);
  }

  runAnalysis(player, input)
    .then(res => {
      console.log('\n--- RESULTADO DA ANÁLISE ---');
      console.log(JSON.stringify(res, null, 2));
    })
    .catch(err => console.error(err.message));
}
