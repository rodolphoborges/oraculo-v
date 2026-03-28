import { supabase, supabaseProtocol } from './supabase.js';
import { fetchMatchJson } from './tracker_api.js';
import fs from 'fs';
import path from 'path';

/**
 * Expande uma requisição 'AUTO' em múltiplos jobs individuais na fila.
 * @param {string} matchId ID da partida
 * @param {string} chatId ID do chat para notificações (opcional)
 * @param {object} metadata Metadados originais
 * @returns {Promise<number>} Número de agentes enfileirados
 */
export async function expandAutoJob(matchId, chatId = null, metadata = {}) {
    console.log(`🤖 Expandindo Match ${matchId} para agentes do Protocolo V...`);
    
    // Garantir diretório local de matches
    const matchesDir = './matches';
    try {
        await fs.promises.access(matchesDir);
    } catch {
        await fs.promises.mkdir(matchesDir, { recursive: true });
    }
    
    const matchJsonPath = path.join(matchesDir, `${matchId}.json`);
    let matchData;
    
    try {
        await fs.promises.access(matchJsonPath);
        const content = await fs.promises.readFile(matchJsonPath, 'utf8');
        matchData = JSON.parse(content);
    } catch {
        matchData = await fetchMatchJson(matchId);
        await fs.promises.writeFile(matchJsonPath, JSON.stringify(matchData, null, 2));
    }
    
    // Extrair tags dos jogadores da partida
    const segments = matchData.data?.segments || [];
    if (!Array.isArray(segments) || segments.length === 0) {
        throw new Error(`Partida ${matchId} não possui dados de segmentos válidos.`);
    }

    const playersInMatch = segments
        .filter(s => s.type === 'player-summary' && s.attributes?.platformUserIdentifier)
        .map(s => s.attributes.platformUserIdentifier);
        
    // Buscar todos os jogadores registrados no banco (FONTE: PROTOCOLO)
    const { data: dbPlayers } = await supabaseProtocol.from('players').select('riot_id');
    const registeredRiotIds = (dbPlayers || []).map(p => p.riot_id.trim().toUpperCase());

    // Filtrar quem participou desta partida e está registrado no banco
    const targets = playersInMatch.filter(p => registeredRiotIds.includes(p.trim().toUpperCase()));
    
    if (targets.length === 0) {
        throw new Error("Nenhum agente registrado no Protocolo V encontrado nesta partida.");
    }

    // RESOLVER N+1: Verificar duplicatas em massa
    const { data: existingJobs } = await supabase
        .from('match_analysis_queue')
        .select('agente_tag')
        .eq('match_id', matchId)
        .in('agente_tag', targets)
        .neq('status', 'failed');

    const existingTags = (existingJobs || []).map(j => j.agente_tag.toUpperCase());
    const newTargets = targets.filter(t => !existingTags.includes(t.toUpperCase()));

    if (newTargets.length === 0) return 0;

    // RESOLVER N+1: Inserir jobs em massa
    const jobsToInsert = newTargets.map(target => {
        const exactDbPlayer = dbPlayers.find(p => p.riot_id.toUpperCase() === target.toUpperCase());
        const finalTag = exactDbPlayer ? exactDbPlayer.riot_id : target;

        return {
            match_id: matchId,
            agente_tag: finalTag,
            status: 'pending',
            metadata: { ...metadata, chat_id: chatId, expanded_from: 'AUTO' }
        };
    });

    const { error: insertError } = await supabase.from('match_analysis_queue').insert(jobsToInsert);
    if (insertError) throw insertError;

    return jobsToInsert.length;
}
