import fs from 'fs';
import path from 'path';
import { generateInsights } from '../lib/openrouter_engine.js';

async function testLLM() {
    const rawData = fs.readFileSync(path.join('./analyses', 'match_b56f4740-e11a-45d5-a966-6f58789ec616_DefeitoDeFábrica_ZzZ.json'), 'utf8');
    const parsedData = JSON.parse(rawData);

    const promptData = {
        match_data: {
            player: parsedData.player,
            agent: parsedData.agent,
            map: parsedData.map,
            kd: parsedData.kd,
            adr: parsedData.adr,
            first_kills: parsedData.first_kills,
            kast: parsedData.kast,
            performance_index: parsedData.performance_index,
            status: parsedData.performance_status,
            events: parsedData.rounds.slice(0, 5) // Sample
        },
        trend: parsedData.all_conselhos,
        history: null,
        squad: parsedData.partners || []
    };

    console.log("Chamando motor IA para", parsedData.player);
    const result = await generateInsights(promptData);
    console.log("Resultado final da IA:", JSON.stringify(result, null, 2));
}

testLLM();
