import { fetchMatchJson } from './lib/tracker_api.js';

async function test() {
    const matchId = '54dd4296-c5a8-421f-8c46-861c201d06b0';
    console.log(`Testing fetch for match: ${matchId}`);
    try {
        const data = await fetchMatchJson(matchId);
        console.log("Success! Data length:", JSON.stringify(data).length);
    } catch (err) {
        console.error("Failed:", err.message);
    }
}

test();
