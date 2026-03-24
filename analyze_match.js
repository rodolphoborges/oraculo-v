import dotenv from 'dotenv';
dotenv.config({ quiet: true });
import { getAgentMeta, getRankBaselines } from './lib/meta_loader.js';
import { fetchMatchJson } from './lib/tracker_api.js';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export async function runAnalysis(playerTag, inputPath, mapName = 'ALL', rank = 'ALL', holtPrev = {}) {
  let matchJsonPath = inputPath;

  // 1. Verifica se o input é um Match ID (UUID)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inputPath);
  
  if (isUuid) {
    const matchesDir = './matches';
    try {
      await fs.promises.access(matchesDir);
    } catch {
      await fs.promises.mkdir(matchesDir, { recursive: true });
    }
    
    matchJsonPath = path.join(matchesDir, `${inputPath}.json`);
    
    try {
      await fs.promises.access(matchJsonPath);
    } catch {
      console.error(`Match ID detectado. Baixando dados para ${matchJsonPath}...`);
      try {
        const data = await fetchMatchJson(inputPath);
        await fs.promises.writeFile(matchJsonPath, JSON.stringify(data, null, 2));
      } catch (err) {
        throw new Error(`Falha ao baixar dados da partida: ${err.message}`);
      }
    }
  }

  // 3. Carrega o JSON da partida
  let matchData;
  try {
    const content = await fs.promises.readFile(matchJsonPath, 'utf8');
    matchData = JSON.parse(content);
  } catch (err) {
    throw new Error(`Erro ao ler arquivo ${matchJsonPath}: ${err.message}`);
  }
  
  // 4. Identifica o agente, mapa e rank do jogador na partida
  if (!matchData.data?.metadata || !matchData.data?.segments) {
    throw new Error('Dados da partida incompletos ou malformados.');
  }

  // VALIDAR MODO: Só aceitamos competitivo
  const queueId = matchData.data.metadata.queueId || "";
  if (queueId.toLowerCase() !== 'competitive') {
    throw new Error(`O Oráculo v4.0 só aceita partidas COMPETITIVAS. Esta partida é de modo: ${matchData.data.metadata.modeName || queueId}`);
  }

  const mapDetected = matchData.data.metadata.mapName;
  
  const segments = matchData.data.segments;
  const normalizedTarget = playerTag.replace(/\s/g, '').toUpperCase();
  const playerSummary = segments.find(s => s.type === 'player-summary' && s.attributes.platformUserIdentifier.replace(/\s/g, '').toUpperCase() === normalizedTarget);
  const playerRound = segments.find(s => s.type === 'player-round' && s.attributes.platformUserIdentifier.replace(/\s/g, '').toUpperCase() === normalizedTarget);
  
  const agentName = playerSummary ? playerSummary.metadata.agentName : (playerRound ? playerRound.metadata.agentName : null);
  const rankDisplay = playerSummary?.stats?.rank?.displayValue || "ALL";
  
  // Normaliza o rank para o formato do vStats (ex: "Gold 2" -> "Gold")
  const rankTier = rankDisplay.split(' ')[0] || "ALL";

  if (!agentName) {
    throw new Error('Jogador não encontrado na partida.');
  }

  // 5. Busca o Meta Baseline Real (vStats.gg via Supabase)
  console.error(`Buscando Meta para: ${agentName} | Mapa: ${mapDetected} | Rank: ${rankTier}...`);
  const meta = await getAgentMeta(agentName, mapDetected, rankTier);
  
  let finalMeta = meta;
  if (!finalMeta) {
    finalMeta = await getAgentMeta(agentName, 'ALL', 'ALL');
  }

  const targetKd = finalMeta ? finalMeta.kd : 1.0;
  const metaCategory = finalMeta ? `${rankTier.toUpperCase()} // VSTATS` : 'BASELINE_AVG';

  // 6. Predição de Ranking
  console.error(`Calculando Predição de Nível Técnico...`);
  const baselines = await getRankBaselines(agentName, mapDetected);
  
    // 6.1. Busca Contexto Estratégico (Histórico e Squad)
    const { getStrategicContext } = await import('./lib/strategic_advisor.js');
    const stratContext = await getStrategicContext(playerTag, isUuid ? inputPath : matchData.data.metadata.matchId);
    const stratJson = JSON.stringify(stratContext);

    // 7. Chama o script Python
    try {
      const pythonScript = path.join(process.cwd(), 'analyze_valorant.py');
      const normalizedMatchPath = path.resolve(matchJsonPath);
      
      console.error(`Executando análise Python: ${pythonScript}`);
      
      const totalRounds = matchData.data.metadata.rounds;
      const teamId = playerSummary?.metadata?.teamId || 'Unknown';

      const pythonArgs = [
        pythonScript, 
        '--json', normalizedMatchPath, 
        '--player', playerTag, 
        '--target-kd', targetKd.toString(),
        '--agent', agentName,
        '--map', mapDetected,
        '--rounds', totalRounds.toString(),
        '--team', teamId,
        '--strat', stratJson
      ];

      // Add Holt parameters if present
      if (holtPrev.performance_l != null) pythonArgs.push('--p-l', holtPrev.performance_l.toString());
      if (holtPrev.performance_t != null) pythonArgs.push('--p-t', holtPrev.performance_t.toString());
      if (holtPrev.kd_l != null) pythonArgs.push('--k-l', holtPrev.kd_l.toString());
      if (holtPrev.kd_t != null) pythonArgs.push('--k-t', holtPrev.kd_t.toString());
      if (holtPrev.adr_l != null) pythonArgs.push('--a-l', holtPrev.adr_l.toString());
      if (holtPrev.adr_t != null) pythonArgs.push('--a-t', holtPrev.adr_t.toString());

      const { spawnSync } = await import('child_process');
      const child = spawnSync('python', pythonArgs, { 
        encoding: 'utf8',
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
        timeout: 5 * 60 * 1000 
      });
      
      if (child.error) throw child.error;
      const stdout = child.stdout;
      const stderr = child.stderr;

      if (stderr && !stdout) {
          console.error("Python Stderr:", stderr);
      }
    
      const analysisResult = JSON.parse(stdout);
      
      // Lógica de Predição Técnica Ponderada (vStats Impact Factor)
      const { estimateTechnicalRank } = await import('./lib/ranking_service.js');
      const estimatedRank = estimateTechnicalRank(analysisResult.kd, analysisResult.adr, baselines);
      
      console.error(`Debug Predicition - Final Estimated Rank:`, estimatedRank);

    // Adiciona informações de meta e predição no resultado
    analysisResult.meta_category = metaCategory;
    analysisResult.target_kd = targetKd;
    analysisResult.estimated_rank = estimatedRank;

    // Garante que a pasta analyses existe
    const analysesDir = './analyses';
    try {
      await fs.promises.access(analysesDir);
    } catch {
      await fs.promises.mkdir(analysesDir, { recursive: true });
    }

    // Salva o relatório local enriquecido (com rank estimado e meta)
    const matchId = isUuid ? inputPath : (analysisResult.match_id || 'unknown');
    const finalReportPath = path.join(analysesDir, `match_${matchId}_${playerTag.replace('#', '_')}.json`);
    await fs.promises.writeFile(finalReportPath, JSON.stringify(analysisResult, null, 2), 'utf8');
    
    return analysisResult;
  } catch (err) {
    throw new Error(`Erro ao executar análise Python: ${err.message}`);
  }
}

// CLI handling - Only run if main
if (process.argv[1] && process.argv[1].endsWith('analyze_match.js')) {
  const args = process.argv.slice(2);
  const player = args[0] || 'OUSADIA#013';
  const input = args[1];

  if (!input) {
    console.error('Uso: node analyze_match.js <PLAYER#TAG> <MATCH_ID|JSON_PATH>');
    process.exit(1);
  }

  runAnalysis(player, input)
    .then(res => {
      // APENAS o JSON no stdout
      console.log(JSON.stringify(res, null, 2));
    })
    .catch(err => {
      console.error(err.message);
      // Se não quiser que o erro interrompa o worker de forma feia, podemos garantir um JSON de erro
      // console.log(JSON.stringify({ error: err.message }));
    });
}
