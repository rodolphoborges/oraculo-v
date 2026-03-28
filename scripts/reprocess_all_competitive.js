import fs from 'fs';
import path from 'path';
import { supabase, supabaseProtocol } from '../lib/supabase.js';

async function run() {
    console.log("🚀 [REPROCESS] Resetando toda a base de jogadores (Holt)...");
    
    // 1. Resetar o estado Holt no Protocolo-V (para re-calcular do zero)
    const { error: pError } = await supabaseProtocol.from('players').update({
        performance_l: null,
        performance_t: null,
        kd_l: null,
        kd_t: null,
        adr_l: null,
        adr_t: null
    }).neq('riot_id', '');

    if (pError) {
        console.error("❌ Erro ao resetar jogadores:", pError.message);
        return;
    }
    console.log("✅ Perfil(is) resetado(s).");

    // 2. Coletar match_ids de todas as partidas e classificar
    console.log("📂 [SCANNER] Lendo diretorio de partidas locais...");
    const MATCHES_DIR = './matches';
    const files = fs.readdirSync(MATCHES_DIR).filter(f => f.endsWith('.json'));
    
    const competitiveMatchIds = new Set();
    const nonCompetitiveMatchIds = new Set();
    const allMatchesData = [];
    
    for (const file of files) {
        const matchId = file.replace('.json', '');
        try {
            const raw = fs.readFileSync(path.join(MATCHES_DIR, file), 'utf8');
            const json = JSON.parse(raw);
            const queueId = json.data?.metadata?.queueId || "";
            
            if (queueId.toLowerCase() === 'competitive') {
                competitiveMatchIds.add(matchId);
                allMatchesData.push({ matchId, json });
            } else {
                nonCompetitiveMatchIds.add(matchId);
            }
        } catch(e) {
            console.warn(`⚠️ Aviso: Nao foi possivel ler o arquivo ${file}`);
        }
    }
    
    console.log(`🎯 Encontradas ${competitiveMatchIds.size} partidas competitivas.`);
    console.log(`🗑  Encontradas ${nonCompetitiveMatchIds.size} partidas NAO competitivas.`);
    
    // 3. Deletar (limpar) partidas não competitivas da fila de analise e IA Insights
    const nonCompArr = Array.from(nonCompetitiveMatchIds);
    const chunkSize = 100;
    let deletedNonComp = 0;
    
    if (nonCompArr.length > 0) {
        console.log(`🧹 Removendo partidas nao competitivas da fila e das analises...`);
        for (let i = 0; i < nonCompArr.length; i += chunkSize) {
            const chunk = nonCompArr.slice(i, i + chunkSize);
            await supabase.from('match_analysis_queue').delete().in('match_id', chunk);
            await supabase.from('ai_insights').delete().in('match_id', chunk);
            await supabaseProtocol.from('ai_insights').delete().in('match_id', chunk);
            deletedNonComp += chunk.length;
        }
        console.log(`✅ Removidos jobs e insights de ${deletedNonComp} partidas nao competitivas.`);
    }

    // 4. Buscar jogadores da base (para re-adicionar na fila)
    const { data: players } = await supabaseProtocol.from('players').select('riot_id');
    const playerTags = (players || []).map(p => p.riot_id.replace(/\s/g, '').toUpperCase());

    // 5. Garantir que APENAS as competitivas estão na fila de analise, e seta-las para 'pending'
    const pendingJobs = [];
    
    for (const data of allMatchesData) {
        const segments = data.json.data?.segments || [];
        const playerSummaries = segments.filter(s => s.type === 'player-summary');
        
        for (const seg of playerSummaries) {
            const pid = seg.attributes?.platformUserIdentifier;
            if (!pid) continue;
            
            const normalizedPid = pid.replace(/\s/g, '').toUpperCase();
            if (playerTags.includes(normalizedPid)) {
                pendingJobs.push({
                    match_id: data.matchId,
                    agente_tag: pid, // usar original
                    status: 'pending',
                    error_message: null,
                    processed_at: null,
                    metadata: { source: 'reprocess_all_competitive' }
                });
            }
        }
    }

    console.log(`🔄 Re-enfileirando ${pendingJobs.length} análises competitivas para 'pending'...`);
    
    let upsertedCount = 0;
    for (let i = 0; i < pendingJobs.length; i += chunkSize) {
        const chunk = pendingJobs.slice(i, i + chunkSize);
        const { error: insErr } = await supabase
            .from('match_analysis_queue')
            .upsert(chunk, { onConflict: 'match_id,agente_tag' });
            
        if (insErr) {
            console.error("❌ Erro ao reenfileirar:", insErr.message);
        } else {
            upsertedCount += chunk.length;
        }
    }

    console.log(`✅ ${upsertedCount} tarefas reconstruídas e definidas como 'pending'.`);
    console.log(`⚡️ O Worker agora reprocessará toda a base competitiva usando a IA atualçada!`);
}

run();
