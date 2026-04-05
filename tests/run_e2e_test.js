
import { exec } from 'child_process';
import { supabase } from './lib/supabase.js';

const PLAYER = 'OzWiX#4384';
const MATCH_ID = '387e47a7-7a69-4d6e-a7eb-65ec00d2feb6';
const API_URL = 'http://localhost:3000/api';

async function runBattery() {
    console.log("🚀 Iniciando Bateria de Testes E2E (Ponta a Ponta) - Oráculo V");
    console.log("---------------------------------------------------------------");

    try {
        // 0. Limpar fila anterior e garantir estado limpo para este Teste
        console.log("🧹 [1/4] Limpando ambiente (removendo testes antigos dessa partida)...");
        await supabase.from('match_analysis_queue').delete().eq('match_id', MATCH_ID).eq('agente_tag', PLAYER);

        // 1. Testar o Serviço de API Server (Enfileirando via HTTP)
        console.log("\n📡 [2/4] Testando API do Servidor (POST /api/queue)...");
        const qtRes = await fetch(`${API_URL}/queue`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ player: PLAYER, matchId: MATCH_ID })
        });
        
        if (!qtRes.ok) {
            throw new Error(`Servidor da API retornou erro: ${qtRes.status} - Certifique-se que o 'node server.js' está ligado num terminal!`);
        }
        const qtData = await qtRes.json();
        console.log(`✅ Servidor respondeu com sucesso! Job ID na Fila: ${qtData.jobId}`);

        // 2. Esperar o Worker Capturar e Processar
        console.log("\n⏳ [3/4] Aguardando o Worker processar a análise em background (motor Python)...");
        console.log("   (Isso depende de você estar rodando 'node worker.js' no outro terminal)");
        let attempts = 0;
        let isComplete = false;
        
        while (attempts < 15 && !isComplete) {
            attempts++;
            const statusRes = await fetch(`${API_URL}/status/${MATCH_ID}?player=${encodeURIComponent(PLAYER)}`);
            if (statusRes.ok) {
                const statusData = await statusRes.json();
                process.stdout.write(`   🔄 Tentativa ${attempts}/15: Status: [${statusData.status}]\r`);
                
                if (statusData.status === 'completed') {
                    isComplete = true;
                    console.log(`\n✅ O Worker interceptou a fila, o Python analisou, e gerou o resultado!`);
                    console.log(`   🔸 Resultado Tático (Trecho): ${statusData.result.conselho_kaio.substring(0, 60)}...`);
                    console.log(`   🔸 Performance: ${statusData.result.performance_index}% -> Rank: ${statusData.result.estimated_rank}`);
                } else if (statusData.status === 'failed') {
                    throw new Error(`Worker falhou o processamento. Motivo: ${statusData.error}`);
                }
            }
            if (!isComplete) await new Promise(r => setTimeout(r, 3000)); // Espera 3s e checa de novo
        }

        if (!isComplete) {
            throw new Error(`Timeout! O Worker não completou a tempo. O 'node worker.js' estava rodando?`);
        }

        // 3. Resultado Final
        console.log("\n🏆 [4/4] BATERIA DE TESTES CONCLUÍDA: SUCESSO ABSOLUTO!");
        console.log("---------------------------------------------------------------");
        console.log("✅ Servidor Rest: OK | ✅ Supabase DB: OK | ✅ Worker: OK | ✅ Python Engine: OK");

    } catch (e) {
        console.error(`\n❌ FALHA CRÍTICA NO TESTE E2E: ${e.message}`);
        console.log(`\n💡 Dica de Resolução: Se a API falhar no passo 2, ligue o 'node server.js' em um console.`);
        console.log(`💡 Se der timeout no passo 3, certifique-se que 'node worker.js' está rodando ativamente.`);
        process.exit(1);
    }
}

runBattery();
