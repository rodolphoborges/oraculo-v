import { validateInsightQuality } from '../lib/openrouter_engine.js';

function runTests() {
    console.log("🧪 Iniciando Testes de Qualidade...");

    const tests = [
        {
            name: "Gekko com Smoke (Deve Falhar)",
            agent: "Gekko",
            map: "Bind",
            insight: {
                diagnostico_principal: "Bom uso de utility",
                tatico: "Use a smoke no bomb A para cobertura",
                foco_treino: ["Dica"]
            },
            expected: false
        },
        {
            name: "Jett com Updraft (Deve Passar)",
            agent: "Jett",
            map: "Ascent",
            insight: {
                diagnostico_principal: "Impacto agressivo",
                tatico: "Use o updraft para pegar off-angle",
                foco_treino: ["Dica"]
            },
            expected: true
        },
        {
            name: "Phoenix com Teleporte (Deve Falhar)",
            agent: "Phoenix",
            map: "Haven",
            insight: {
                diagnostico_principal: "Duelo constante",
                tatico: "Use o teleporte para rotacionar rápido",
                foco_treino: ["Dica"]
            },
            expected: false
        },
        {
            name: "Termo Proibido 'menear' (Deve Falhar)",
            agent: "Raze",
            map: "Breeze",
            insight: {
                diagnostico_principal: "Você deve menear sua mira",
                tatico: "Conselho",
                foco_treino: ["Dica"]
            },
            expected: false
        }
    ];

    let passedAll = true;
    for (const t of tests) {
        const result = validateInsightQuality(t.insight, t.map, t.agent);
        if (result === t.expected) {
            console.log(`✅ ${t.name} passed.`);
        } else {
            console.error(`❌ ${t.name} FAILED! Expected ${t.expected}, got ${result}`);
            passedAll = false;
        }
    }

    if (passedAll) {
        console.log("\n✨ Todos os testes de qualidade passaram!");
    } else {
        process.exit(1);
    }
}

runTests();
