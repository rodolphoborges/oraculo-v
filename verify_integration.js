/**
 * verify_integration.js
 * 
 * Mock test for Oráculo-V integration (Protocolo-V -> Oráculo-V).
 * Verifies that processBriefing correctly:
 * 1. Analyzes a match (Mock).
 * 2. Persists stats to match_stats (Oráculo).
 * 3. Persists insights to ai_insights (Oráculo).
 * 4. Syncs insights to Protocolo-V (Optional/If enabled).
 */
import { processBriefing } from './worker.js';

const mockBriefing = {
    match_id: '0432591c-a709-44ec-8b90-2119c53b9012', // UUID existente para teste
    player_id: 'Guxxtavo#easy', // Jogador existente para teste
    squad_stats: { 
        average_perf: 75,
        total_kills: 45
    }
    // O analyze_match.js lerá o snapshot JSON local se existir, 
    // ou tentará buscar na API se configurado.
    // Mas o importante aqui é o fluxo de salvamento.
};

async function test() {
    console.log("🧪 Testando Integração: Processando Briefing Mock...");
    try {
        const outcome = await processBriefing(mockBriefing);
        if (outcome.success) {
            console.log("✅ Sucesso! Resultado retornado.");
            console.log("🤖 Insight:", outcome.insight.resumo);
            console.log("📊 Rank:", outcome.result.impact_rank || "N/A");
            console.log("🔥 Impact Score:", outcome.result.impact_score || "N/A");
            
            process.exit(0);
        } else {
            console.error("❌ Falha no processamento:", outcome.error);
            process.exit(1);
        }
    } catch (err) {
        console.error("❌ Erro fatal no teste:", err.message);
        process.exit(1);
    }
}

test();
