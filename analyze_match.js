import dotenv from 'dotenv';
dotenv.config({ quiet: true });
import { getAgentMeta, getRankBaselines } from './lib/meta_loader.js';
import { fetchMatchJson } from './lib/tracker_api.js';
import { supabase } from './lib/supabase.js';
import ImpactAnalyzer from './services/ImpactAnalyzer.js';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export async function runAnalysis(playerTag, inputPath, mapNameInput = 'ALL', rank = 'ALL', holtPrev = {}, agentNameInput = 'ALL') {
  console.log(`🧠 [ANALYSIS] Iniciando motor tático para ${playerTag}...`);
  let matchJsonPathFinal = inputPath;
  let mapName = mapNameInput;
  let agentName = agentNameInput;

  // 1. Verifica se o input é um Match ID (UUID)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inputPath);
  
  if (isUuid) {
    const matchesDir = './matches';
    try {
      if (!fs.existsSync(matchesDir)) {
        await fs.promises.mkdir(matchesDir, { recursive: true });
      }
    } catch (e) { /* Ignora se já existe */ }
    
    const matchJsonPath = path.join(matchesDir, `${inputPath}.json`);
    const tempPath = path.join(matchesDir, `${inputPath}.tmp`);
    
    try {
      // 1. Verificação de Cache
      const stats = await fs.promises.stat(matchJsonPath);
      if (stats.size > 0) {
        console.log(`📊 [ANALYSIS] Usando cache local para partida ${inputPath}`);
      } else {
        throw new Error("Arquivo vazio");
      }
    } catch (err) {
      // 2. Proteção de Concorrência: Se o .tmp existe, aguarda um pouco
      try {
        await fs.promises.access(tempPath);
        console.warn(`⏳ [LOCK] Partida ${inputPath} já está sendo baixada. Aguardando...`);
        await new Promise(r => setTimeout(r, 5000)); // Aguarda 5s
        return await runAnalysis(playerTag, inputPath, mapNameInput, rank, holtPrev, agentNameInput);
      } catch (lockErr) {
        // Segue para o download
      }

      console.error(`Match ID detectado. Baixando dados para ${matchJsonPath}...`);
      try {
        const data = await fetchMatchJson(inputPath);
        if (!data || Object.keys(data).length === 0) throw new Error('Dados da API vazios.');
        
        // Escreve em arquivo TEMP primeiro para garantir atomicidade
        await fs.promises.writeFile(tempPath, JSON.stringify(data, null, 2));
        await fs.promises.rename(tempPath, matchJsonPath);
        
        console.log(`✅ [CACHE] Dados da partida ${inputPath} persistidos com sucesso.`);
      } catch (dlErr) {
        // Limpa arquivos residuais se houver falha
        if (fs.existsSync(tempPath)) await fs.promises.unlink(tempPath).catch(() => {});
        if (fs.existsSync(matchJsonPath)) await fs.promises.unlink(matchJsonPath).catch(() => {});
        throw new Error(`Falha ao baixar dados da partida: ${dlErr.message}`);
      }
    }
    matchJsonPathFinal = matchJsonPath;
  }

  // 3. Carrega o JSON da partida
  let matchData;
  try {
    const content = await fs.promises.readFile(matchJsonPathFinal, 'utf8');
    matchData = JSON.parse(content);
  } catch (err) {
    throw new Error(`Erro ao ler arquivo ${matchJsonPathFinal}: ${err.message}`);
  }
  
  // 4. Identifica o agente, mapa e rank do jogador na partida
  const playerTagUpper = playerTag.replace(/\s/g, '').toUpperCase();
  const playerSegment = matchData.data.segments.find(s =>
    s.type === 'player-summary' &&
    (s.attributes?.platformUserIdentifier?.replace(/\s/g, '').toUpperCase() === playerTagUpper ||
     s.metadata?.platformUserIdentifier?.replace(/\s/g, '').toUpperCase() === playerTagUpper)
  );
  
  if (agentName === 'ALL') {
    agentName = playerSegment?.metadata?.agentName || 'Combatente';
  }
  
  if (mapName === 'ALL') {
    mapName = matchData.data.metadata?.mapName || 'Desconhecido';
  }

  if (!matchData.data?.metadata || !matchData.data?.segments) {
    throw new Error('Dados da partida incompletos ou malformados.');
  }

  // VALIDAR MODO: Só aceitamos competitivo
  const queueId = matchData.data.metadata.queueId || "";
  if (queueId.toLowerCase() !== 'competitive') {
    throw new Error(`O Oráculo v4.0 só aceita partidas COMPETITIVAS. Esta partida é de modo: ${matchData.data.metadata.modeName || queueId}`);
  }

  const mapDetected = mapName;
  
  const segments = matchData.data.segments;
  const normalizedTarget = playerTag.replace(/\s/g, '').toUpperCase();
  const playerSummary = segments.find(s => s.type === 'player-summary' && s.attributes.platformUserIdentifier.replace(/\s/g, '').toUpperCase() === normalizedTarget);
  const playerRound = segments.find(s => s.type === 'player-round' && s.attributes.platformUserIdentifier.replace(/\s/g, '').toUpperCase() === normalizedTarget);
  
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

    // 6.2. Busca Templates de Comentários (Banco de Termos Dinâmico)
    let templates = [];
    if (supabase) {
      console.error(`Buscando Templates de Comentários...`);
      const { data: templateData } = await supabase.from('round_comment_templates').select('event_type, template');
      templates = templateData || [];
    }
    const templatesJson = JSON.stringify(templates);

    // 7. Chama o script Python
    try {
      const pythonScript = path.join(process.cwd(), 'analyze_valorant.py');
      const normalizedMatchPath = path.resolve(matchJsonPathFinal);
      
      console.error(`Executando análise Python: ${pythonScript}`);
      
      const totalRounds = matchData.data.metadata.rounds;
      const teamId = playerSummary?.metadata?.teamId || 'Unknown';

      // Resolve role via ImpactAnalyzer para passar ao Python
      const resolvedRole = ImpactAnalyzer.ROLE_MAPPING[agentName] || 'Duelista';

      const pythonArgs = [
        pythonScript,
        '--json', normalizedMatchPath,
        '--player', playerTag,
        '--target-kd', targetKd.toString(),
        '--agent', agentName,
        '--role', resolvedRole,
        '--map', mapDetected,
        '--rounds', totalRounds.toString(),
        '--team', teamId,
        '--strat', stratJson,
        '--templates', templatesJson
      ];

      // Add Holt parameters if present
      if (holtPrev.performance_l != null) pythonArgs.push('--p-l', holtPrev.performance_l.toString());
      if (holtPrev.performance_t != null) pythonArgs.push('--p-t', holtPrev.performance_t.toString());
      if (holtPrev.kd_l != null) pythonArgs.push('--k-l', holtPrev.kd_l.toString());
      if (holtPrev.kd_t != null) pythonArgs.push('--k-t', holtPrev.kd_t.toString());
      if (holtPrev.adr_l != null) pythonArgs.push('--a-l', holtPrev.adr_l.toString());
      if (holtPrev.adr_t != null) pythonArgs.push('--a-t', holtPrev.adr_t.toString());

      const { spawn } = await import('child_process');
      const child = spawn('python', pythonArgs, { 
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
        timeout: 5 * 60 * 1000 
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => { stdout += data.toString(); });
      child.stderr.on('data', (data) => { stderr += data.toString(); });

      const exitCode = await new Promise((resolve) => {
        child.on('close', resolve);
        child.on('error', (err) => {
          console.error("Erro ao iniciar processo Python:", err);
          resolve(1);
        });
      });
      
      if (exitCode !== 0) {
          console.error("Python Stderr:", stderr);
          throw new Error(`O processo de análise Python falhou com código ${exitCode}. Verifique os logs do servidor.`);
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

    // [NOVO - Idempotência UI] Preserva o insight da IA se já existir no arquivo local
    // Isso evita que o Dashboard "pisque" e esconda os Prós/Contras durante o re-processamento
    const matchId = isUuid ? inputPath : (analysisResult.match_id || 'unknown');
    const finalReportPath = path.join(analysesDir, `match_${matchId}_${playerTag.replace('#', '_')}.json`);
    
    try {
        const existingRaw = await fs.promises.readFile(finalReportPath, 'utf8');
        const existingData = JSON.parse(existingRaw);
        if (existingData.conselho_kaio && typeof existingData.conselho_kaio === 'object') {
            console.error(`♻️ [IDEMPOTENCY] Mesclando Insight IA existente para evitar interrupção na UI.`);
            analysisResult.conselho_kaio = existingData.conselho_kaio;
        }
    } catch (e) { /* Arquivo não existe ou é inválido, segue normal */ }

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
