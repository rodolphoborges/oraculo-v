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
    if (!fs.existsSync(matchesDir)) fs.mkdirSync(matchesDir);
    
    matchJsonPath = path.join(matchesDir, `${inputPath}.json`);
    
    if (!fs.existsSync(matchJsonPath)) {
      console.error(`Match ID detectado. Baixando dados para ${matchJsonPath}...`);
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

  // 3. Carrega o JSON da partida
  const matchData = JSON.parse(fs.readFileSync(matchJsonPath, 'utf8'));
  
  // 4. Identifica o agente, mapa e rank do jogador na partida
  if (!matchData.data?.metadata || !matchData.data?.segments) {
    throw new Error('Dados da partida incompletos ou malformados.');
  }

  const mapDetected = matchData.data.metadata.mapName;
  
  const segments = matchData.data.segments;
  const playerSummary = segments.find(s => s.type === 'player-summary' && s.attributes.platformUserIdentifier.toUpperCase() === playerTag.toUpperCase());
  const playerRound = segments.find(s => s.type === 'player-round' && s.attributes.platformUserIdentifier.toUpperCase() === playerTag.toUpperCase());
  
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
        '--team', teamId
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
    let estimatedRank = 'PRATA/BRONZE';
    const actualKd = analysisResult.kd;
    const actualAdr = analysisResult.adr;
    
    // Ordena baselines por um "Score de Impacto" (Simplesmente do maior rank pro menor)
    const sortedBaselines = baselines.sort((a, b) => (b.kd + b.adr/100) - (a.kd + a.adr/100));
    
    for (const b of sortedBaselines) {
      // Cálculo de Ratio Ponderado: 40% KD, 60% ADR
      const kdRatio = actualKd / b.kd;
      const adrRatio = actualAdr / b.adr;
      const combinedImpact = (kdRatio * 0.4) + (adrRatio * 0.6);
      
      if (combinedImpact >= 0.97) {
        estimatedRank = b.rank;
        break;
      }
    }
    
    console.error(`Debug Predicition - Final Estimated Rank:`, estimatedRank);

    // Adiciona informações de meta e predição no resultado
    analysisResult.meta_category = metaCategory;
    analysisResult.target_kd = targetKd;
    analysisResult.estimated_rank = estimatedRank;

    // Garante que a pasta analyses existe
    const analysesDir = './analyses';
    if (!fs.existsSync(analysesDir)) fs.mkdirSync(analysesDir);

    // Salva o relatório local enriquecido (com rank estimado e meta)
    const finalReportPath = path.join(analysesDir, `analysis_${playerTag.replace('#', '_')}.json`);
    fs.writeFileSync(finalReportPath, JSON.stringify(analysisResult, null, 2), 'utf8');
    
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
