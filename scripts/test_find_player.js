import { fetchMatchJson } from './lib/tracker_api.js';

async function test(matchId, playerTag) {
    console.log(`Testing for match: ${matchId} | Player: ${playerTag}`);
    try {
        const data = await fetchMatchJson(matchId);
        console.log("Success! Data length:", JSON.stringify(data).length);
        
        const segments = data.data.segments;
        const player = segments.find(s => s.type === 'player-summary' && s.attributes.platformUserIdentifier.toUpperCase() === playerTag.toUpperCase());
        
        if (player) {
            console.log("Found player in JSON!");
        } else {
            console.log("Player NOT found in JSON.");
            const allPlayers = segments.filter(s => s.type === 'player-summary').map(s => s.attributes.platformUserIdentifier);
            console.log("Available players:", allPlayers);
        }
    } catch (err) {
        console.error("Failed:", err.message);
    }
}

// Test one that had "Jogador não encontrado"
test('21bd4e6a-46ae-4c71-bff0-dab081285d48', 'Fadinha Do FF #nobru');
