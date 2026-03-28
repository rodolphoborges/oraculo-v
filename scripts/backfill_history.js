/**
 * scripts/backfill_history.js
 * 
 * Scanner de Histórico para Oráculo-V.
 * Localiza todas as partidas locais (./matches/*.json), cruza com os jogadores
 * registrados no Protocolo-V e enfileira as análises de IA pendentes.
 */
import fs from 'fs';
import path from 'path';
import { supabase, supabaseProtocol } from '../lib/supabase.js';

const MATCHES_DIR = './matches';

async function runBackfill() {
    console.log("🚀 [BACKFILL] Iniciando Motor de Histórico...");
    
    // 1. Buscar todos os jogadores oficiais do Protocolo-V
    const { data: players, error: pErr } = await supabaseProtocol.from('players').select('riot_id');
    if (pErr) {
        console.error("❌ Erro ao buscar lista de jogadores:", pErr.message);
        return;
    }
    const riotIds = players.map(p => p.riot_id.replace(/\s/g, '').toUpperCase());
    console.log(`📡 [DISCOVERY] Monitorando ${riotIds.length} Atletas Oficiais.`);

    // 2. Listar arquivos de Partidas Locais
    const files = fs.readdirSync(MATCHES_DIR).filter(f => f.endsWith('.json'));
    console.log(`📂 [SCANNER] Localizados ${files.length} arquivos de partidas no diretório local.`);

    // 3. Buscar o que já foi analisado pela IA (Deduplicação)
    const { data: insights, error: iErr } = await supabase.from('ai_insights').select('player_id, match_id');
    if (iErr) {
        console.error("❌ Erro ao buscar insights existentes:", iErr.message);
        return;
    }
    const analisesProntas = new Set(insights.map(i => `${i.player_id.toUpperCase()}_${i.match_id}`));
    console.log(`🧠 [MEMORY] Ignorando ${analisesProntas.size} análises que já possuem insight de IA.`);

    let enqueuedCount = 0;
    const pendingJobs = [];

    // 4. Mapear Player x Partida
    for (const file of files) {
        const matchId = file.replace('.json', '');
        
        try {
            const raw = fs.readFileSync(path.join(MATCHES_DIR, file), 'utf8');
            const json = JSON.parse(raw);
            
            if (!json.data?.segments) continue;

            // Filtro para COMPETITIVO (Requisito do Oráculo v4.0)
            const queueId = json.data.metadata?.queueId || "";
            if (queueId.toLowerCase() !== 'competitive') continue;

            const segments = json.data.segments.filter(s => s.type === 'player-summary');

            for (const seg of segments) {
                const pid = seg.attributes?.platformUserIdentifier;
                if (!pid) continue;

                const normalizedPid = pid.replace(/\s/g, '').toUpperCase();
                
                // Se o jogador estiver na nossa lista de monitorados
                if (riotIds.includes(normalizedPid)) {
                    // E se ainda não tiver insight gerado
                    if (!analisesProntas.has(`${normalizedPid}_${matchId}`)) {
                        pendingJobs.push({
                            match_id: matchId,
                            agente_tag: pid, // Usamos a tag original para a API/Worker
                            status: 'pending',
                            metadata: { source: 'backfill_engine' }
                        });
                    }
                }
            }
        } catch (err) {
            console.warn(`⚠️ Erro ao processar arquivo ${file}:`, err.message);
        }
    }

    console.log(`\n🎯 [QUEUE] Localizados ${pendingJobs.length} novos jobs de análise pendentes.`);

    if (pendingJobs.length === 0) {
        console.log("✅ Nada para processar. O histórico está em dia!");
        return;
    }

    // 5. Enfileirar (em blocos de 100 para evitar timeout do Supabase)
    const chunkSize = 100;
    for (let i = 0; i < pendingJobs.length; i += chunkSize) {
        const chunk = pendingJobs.slice(i, i + chunkSize);
        console.log(`📡 [BULK] Inserindo bloco de ${chunk.length} jobs na fila...`);
        const { error: insErr } = await supabase.from('match_analysis_queue').insert(chunk);
        if (insErr) {
            console.error("❌ Erro ao enfileirar chunk:", insErr.message);
        } else {
            enqueuedCount += chunk.length;
        }
    }

    console.log(`\n🏆 [BACKFILL FINALIZADO]`);
    console.log(`-----------------------------------------------`);
    console.log(`✅ Total de jobs adicionados: ${enqueuedCount}`);
    console.log(`🚀 DICA: Execute 'npm run worker' para começar a processar!`);
}

runBackfill();
