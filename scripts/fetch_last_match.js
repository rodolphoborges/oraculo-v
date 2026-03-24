import dotenv from 'dotenv';
dotenv.config({ path: '.env', override: true, quiet: true });

async function getLastMatch() {
    const name = "OUSADIA";
    const tag = "013";
    const apiKey = process.env.HENRIK_API_KEY;
    const url = `https://api.henrikdev.xyz/valorant/v3/matches/br/${encodeURIComponent(name)}/${encodeURIComponent(tag)}?size=1`;
    
    try {
        const res = await fetch(url, { headers: { 'Authorization': apiKey } });
        const json = await res.json();
        if (json.data && json.data.length > 0) {
            console.log("MATCH_ID=" + json.data[0].metadata.matchid);
        } else {
            console.log("No matches found or rate limit hit. Status:", res.status);
            if (res.status === 429) console.log("Rate limit!");
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}
getLastMatch();
