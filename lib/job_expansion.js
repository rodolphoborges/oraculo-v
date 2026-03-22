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
    if (!fs.existsSync(matchesDir)) fs.mkdirSync(matchesDir);
    
    const matchJsonPath = path.join(matchesDir, `${matchId}.json`);
    let matchData;
    
    if (fs.existsSync(matchJsonPath)) {
        matchData = JSON.parse(fs.readFileSync(matchJsonPath, 'utf8'));
    } else {
        matchData = await fetchMatchJson(matchId);
        fs.writeFileSync(matchJsonPath, JSON.stringify(matchData, null, 2));
    }
    
    // Extrair tags dos jogadores da partida
    const segments = matchData.data?.segments || [];
    const playersInMatch = segments
        .filter(s => s.type === 'player-summary' && s.attributes?.platformUserIdentifier)
        .map(s => s.attributes.platformUserIdentifier);
        
    // Buscar todos os jogadores registrados no banco (FONTE: PROTOCOLO)
    const { data: dbPlayers } = await supabaseProtocol.from('players').select('riot_id');
    const registeredRiotIds = (dbPlayers || []).map(p => p.riot_id.toUpperCase());

    // Filtrar quem participou desta partida e está registrado no banco
    const targets = playersInMatch.filter(p => registeredRiotIds.includes(p.toUpperCase()));
    
    if (targets.length === 0) {
        throw new Error("Nenhum agente registrado no Protocolo V encontrado nesta partida.");
    }

    // Inserir um job pendente individual para cada player
    let count = 0;
    for (const target of targets) {
        const exactDbPlayer = dbPlayers.find(p => p.riot_id.toUpperCase() === target.toUpperCase());
        const finalTag = exactDbPlayer ? exactDbPlayer.riot_id : target;

        // Verificar duplicata antes de inserir
        const { data: existing } = await supabase
            .from('match_analysis_queue')
            .select('id')
            .eq('match_id', matchId)
            .eq('agente_tag', finalTag)
            .neq('status', 'failed')
            .limit(1);

        if (existing && existing.length > 0) continue;

        await supabase.from('match_analysis_queue').insert([{
            match_id: matchId,
            agente_tag: finalTag,
            chat_id: chatId,
            status: 'pending',
            metadata: { ...metadata, expanded_from: 'AUTO' }
        }]);
        count++;
    }

    return count;
}
