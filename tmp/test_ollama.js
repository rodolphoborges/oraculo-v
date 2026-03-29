async function test() {
    try {
        console.log("Testing Ollama connection with native fetch...");
        const resp = await fetch('http://localhost:11434/api/tags');
        if (resp.ok) {
            const json = await resp.json();
            console.log("Ollama tags:", JSON.stringify(json, null, 2));
        } else {
            console.error("Ollama error:", resp.status);
        }
    } catch (e) {
        console.error("Fetch failed:", e.message);
    }
}

test();
