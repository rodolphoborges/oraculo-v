import dotenv from 'dotenv';
dotenv.config({ quiet: true });
import { getAgentMeta, getRankBaselines } from './lib/meta_loader.js';
import { getAgent } from './lib/tactical_knowledge.js';
import { fetchMatchJson } from './lib/tracker_api.js';
import { supabase } from './lib/supabase.js';
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
      // 2. Proteção de Concorrência: Se o .tmp existe, algo deu errado na execução anterior
      try {
        await fs.promises.access(tempPath);
        console.warn(`⚠️ [LOCK] Partida ${inputPath} tinha um arquivo temporário residual. Limpando...`);
        await fs.promises.unlink(tempPath).catch(() => {});
      } catch (lockErr) {
        // Segue para o download
      }

      console.log(`🌐 [NETWORK] Baixando dados via Tracker-GG para ${inputPath}...`);
      const startTime = Date.now();
      try {
        const data = await fetchMatchJson(inputPath);
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        
        if (!data || Object.keys(data).length === 0) throw new Error('Dados da API vazios.');
        
        // Escreve em arquivo TEMP primeiro para garantir atomicidade
        await fs.promises.writeFile(tempPath, JSON.stringify(data, null, 2));
        await fs.promises.rename(tempPath, matchJsonPath);
        
        console.log(`✅ [CACHE] Dados da partida ${inputPath} persistidos em ${duration}s.`);
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
  const playerPrefix = normalizedTarget.split('#')[0];

  const playerSummary = segments.find(s => {
    if (s.type !== 'player-summary') return false;
    const ident = (s.attributes?.platformUserIdentifier || s.metadata?.platformUserIdentifier || "").replace(/\s/g, '').toUpperCase();
    return ident === normalizedTarget || ident.split('#')[0] === playerPrefix;
  });

  const playerRound = segments.find(s => {
    if (s.type !== 'player-round') return false;
    const ident = (s.attributes?.platformUserIdentifier || "").replace(/\s/g, '').toUpperCase();
    return ident === normalizedTarget || ident.split('#')[0] === playerPrefix;
  });

  
  const rankDisplay = playerSummary?.stats?.rank?.displayValue || "ALL";
  
  // Normaliza o rank para o formato do vStats (ex: "Gold 2" -> "Gold")
  const rankTier = rankDisplay.split(' ')[0] || "ALL";

  // Se o agentName não foi detectado corretamente, tenta extrair do summary encontrado
  if ((!agentName || agentName === 'Combatente') && playerSummary?.metadata?.agentName) {
      agentName = playerSummary.metadata.agentName;
      console.error(`🔄 [AUTO-FIX] Agente corrigido para: ${agentName}`);
  }

  if (!agentName || agentName === 'Combatente') {
    console.warn('⚠️ [WARNING] Jogador detectado, mas nome do Agente ausente no segmento.');
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

    // 6.3. Busca Parametrização Tática (Thresholds e Globais)
    let configPayload = { roles: [], globals: [] };
    if (supabase) {
      console.error(`Buscando Parametrização Tática...`);
      const { data: rolesConfig } = await supabase.from('tactical_roles_config').select('*');
      const { data: globalConfig } = await supabase.from('global_tactical_config').select('*');
      configPayload.roles = rolesConfig || [];
      configPayload.globals = globalConfig || [];
    }
    const configJson = JSON.stringify(configPayload);

    // 7. Chama o Motor JS Nativo (Portado de Python v4.2)
    try {
      console.error(`🚀 [ENGINE] Executando motor tático JS nativo...`);
      const { resolveRole, calculatePerformanceIndex, processRounds, generateTacticalInsights } = await import('./lib/analyze_valorant.js');
      
      const teamId = playerSummary?.metadata?.teamId || 'Unknown';
      const resolvedRole = resolveRole(agentName, playerSummary?.metadata?.roleName);
      
      const { roundsAnalysis, firstKills, firstDeaths } = processRounds(matchData, playerTag);
      
      const stats = playerSummary.stats;
      const totalRounds = matchData.data.metadata.rounds;
      const adr = stats.damage.value / totalRounds;
      const actualKd = stats.kills.value / Math.max(1, stats.deaths.value);
      const kast = stats.kast?.value || 0;
      const acs = stats.score.value / totalRounds;

      const perfIdx = calculatePerformanceIndex(actualKd, targetKd, adr, resolvedRole, kast, firstKills);
      const insights = generateTacticalInsights(perfIdx, resolvedRole, { adr, firstBloods: firstKills }, {});

      const analysisResult = {
        player: playerTag, agent: agentName, role: resolvedRole, map: mapDetected,
        acs, adr, kd: actualKd, kast, performance_index: perfIdx, impact_score: perfIdx,
        performance_status: insights.technicalRank === "Alpha" ? "ELITE DO PROTOCOLO" : "OMNICRÔNICA",
        technical_rank: insights.technicalRank, squad_stats: [],
        tone_instruction: "Coach analítico e direto.",
        kills: stats.kills.value, deaths: stats.deaths.value,
        clutches: stats.clutches?.value || 0,
        first_kills: firstKills, first_deaths: firstDeaths,
        is_win: playerSummary.metadata.result === 'victory',
        result: playerSummary.metadata.result === 'victory' ? 'VITÓRIA' : 'DERROTA',
        matches_analyzed: 1, holt: {},
        conselho_kaio: insights.conselho, all_conselhos: insights.allConselhos,
        total_rounds: totalRounds, rounds: roundsAnalysis
      };
      
      const { estimateTechnicalRank } = await import('./lib/ranking_service.js');
      const estimatedRank = estimateTechnicalRank(analysisResult.kd, analysisResult.adr, baselines);
      
      analysisResult.technical_rank_display = estimatedRank;
      analysisResult.estimated_rank = estimatedRank;
      analysisResult.player_rank = rankDisplay;
      analysisResult.hs_percent = playerSummary.stats.hsAccuracy?.value || 0;

      const analysesDir = './analyses';
      try { await fs.promises.mkdir(analysesDir, { recursive: true }); } catch (e) {}

      const matchId = isUuid ? inputPath : (analysisResult.match_id || 'unknown');
      const finalReportPath = path.join(analysesDir, `match_${matchId}_${playerTag.trim().replace('#', '_')}.json`);
      
      await fs.promises.writeFile(finalReportPath, JSON.stringify(analysisResult, null, 2), 'utf8');
      return analysisResult;
    } catch (err) {
      console.error(`❌ [ENGINE ERROR] Falha no motor JS: ${err.message}`);
      throw new Error(`Falha na análise tática: ${err.message}`);
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
