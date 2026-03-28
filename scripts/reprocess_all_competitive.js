import fs from 'fs';
import path from 'path';
import { supabase, supabaseProtocol } from '../lib/supabase.js';

async function run() {
    console.log("💀 [FULL-RESET] Iniciando limpeza total da inteligência tática...");
    
    // 1. Limpar Insights de IA (Ambas as bases)
    console.log("🗑️ Deletando todos os registros de 'ai_insights'...");
    const { error: aiErr1 } = await supabase.from('ai_insights').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (aiErr1) console.warn("⚠️ Erro ao limpar Oráculo ai_insights:", aiErr1.message);
    
    if (supabaseProtocol) {
        const { error: aiErr2 } = await supabaseProtocol.from('ai_insights').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (aiErr2) console.warn("⚠️ Erro ao limpar Protocolo ai_insights:", aiErr2.message);
    }

    // 2. Limpar estatísticas estruturadas (Opcional, mas recomendado para coerência total)
    console.log("🗑️ Deletando estatísticas estruturadas ('match_stats', 'matches')...");
    await supabase.from('match_stats').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('matches').delete().neq('match_id', '00000000-0000-0000-0000-000000000000');

    // 3. Resetar o estado Holt no Protocolo-V (para re-calcular do zero)
    console.log("🔄 Resetando tendências de jogadores (Holt-Winters)...");
    const { error: pError } = await supabaseProtocol.from('players').update({
        performance_l: null, performance_t: null,
        kd_l: null, kd_t: null,
        adr_l: null, adr_t: null
    }).neq('riot_id', '');

    if (pError) console.error("❌ Erro ao resetar jogadores:", pError.message);

    // 4. Limpar e Re-popular a Fila
    console.log("🧹 Esvaziando a fila de processamento...");
    // Usamos um filtro que sempre retorna verdadeiro e é compatível com o tipo da coluna
    await supabase.from('match_analysis_queue').delete().gt('id', 0);

    // 5. Coletar match_ids competitivos locais
    console.log("📂 [SCANNER] Re-escaneando diretório './matches'...");
    const MATCHES_DIR = './matches';
    const files = fs.readdirSync(MATCHES_DIR).filter(f => f.endsWith('.json'));
    
    const competitiveMatchIds = new Set();
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
            }
        } catch(e) { /* skip bad files */ }
    }
    
    console.log(`🎯 Encontradas ${competitiveMatchIds.size} partidas competitivas.`);

    // 6. Buscar jogadores registrados
    const { data: players } = await supabaseProtocol.from('players').select('riot_id');
    const playerTags = (players || []).map(p => p.riot_id.replace(/\s/g, '').toUpperCase());

    // 7. Gerar jobs
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
                    agente_tag: pid,
                    status: 'pending',
                    metadata: { source: 'FULL_REPROCESS_V4' }
                });
            }
        }
    }

    // 8. Inserir em lotes
    console.log(`🔄 Re-enfileirando ${pendingJobs.length} tarefas globais...`);
    const chunkSize = 50;
    for (let i = 0; i < pendingJobs.length; i += chunkSize) {
        const chunk = pendingJobs.slice(i, i + chunkSize);
        await supabase.from('match_analysis_queue').insert(chunk);
    }

    console.log(`🏆 [SUCESSO] Base resetada e ${pendingJobs.length} jobs aguardando processamento ELITE.`);
    console.log(`🚀 Reinicie o worker para começar o backfill.`);
}

run();
