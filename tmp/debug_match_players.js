
import { supabase, supabaseProtocol } from '../lib/supabase.js';
import { fetchMatchJson } from '../lib/tracker_api.js';
import fs from 'fs';
import path from 'path';

async function diagnose() {
    const matchId = 'b964df15-e6cb-4f99-9931-ed59b43a0d3c';
    const targetPlayers = ['m4sna#chama', 'DefeitoDeFábrica#ZzZ'];
    
    console.log(`🔍 Diagnóstico para Match: ${matchId}`);
    
    // 1. Buscar Partida
    let matchData;
    const cachePath = `./matches/${matchId}.json`;
    if (fs.existsSync(cachePath)) {
        matchData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    } else {
        console.log("Baixando JSON da partida...");
        matchData = await fetchMatchJson(matchId);
    }
    
    const segments = matchData.data?.segments || [];
    const playersInMatch = segments
        .filter(s => s.type === 'player-summary')
        .map(s => s.attributes.platformUserIdentifier);
    
    console.log("\n--- JOGADORES NA PARTIDA (Tracker) ---");
    playersInMatch.forEach(p => console.log(`- ${p}`));
    
    // 2. Buscar Jogadores no Banco (Protocolo)
    console.log("\n--- JOGADORES NO BANCO (Protocolo) ---");
    const { data: dbPlayers } = await supabaseProtocol.from('players').select('riot_id');
    const registered = (dbPlayers || []).map(p => p.riot_id);
    
    targetPlayers.forEach(p => {
        const found = registered.find(r => r.toUpperCase() === p.toUpperCase());
        console.log(`${p}: ${found ? `✅ Encontrado no banco como "${found}"` : '❌ NÃO ENCONTRADO NO BANCO'}`);
    });
    
    // 3. Verificar Fila (Oráculo)
    console.log("\n--- STATUS NA FILA (Oráculo) ---");
    const { data: queueItems } = await supabase
        .from('match_analysis_queue')
        .select('agente_tag, status, error_message')
        .eq('match_id', matchId);
    
    if (queueItems && queueItems.length > 0) {
        queueItems.forEach(item => {
            console.log(`- ${item.agente_tag}: [${item.status}] ${item.error_message || ''}`);
        });
    } else {
        console.log("❌ NENHUM JOGADOR ENCONTRADO NA FILA PARA ESTA PARTIDA.");
    }
}

diagnose();
