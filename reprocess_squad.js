/**
 * reprocess_squad.js
 * 
 * Script de manutenção do Oráculo V:
 * Reprocessa as últimas 20 partidas de squad utilizando o motor de IA mais recente.
 * Prioriza o modelo local (Ollama) para evitar custos de tokens.
 */

import { supabaseProtocol } from './lib/supabase.js';
import { processBriefing } from './worker.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env', override: true, quiet: true });

// Configuração de Prioridade
process.env.FORCE_OLLAMA = 'true';

async function reprocess() {
    console.log('--- 🚀 INICIANDO REPROCESSAMENTO DE SQUAD (LAST 20) ---');
    console.log('🏠 MODO: Prioridade Ollama (Local)');

    if (!supabaseProtocol) {
        console.error('❌ Erro: Cliente do Protocolo-V não configurado.');
        return;
    }

    try {
        // 1. Buscar as últimas 20 operações de squad (não Deathmatch)
        const { data: operations, error: opError } = await supabaseProtocol
            .from('operations')
            .select(`
                id,
                map_name,
                started_at,
                operation_squads (
                    riot_id,
                    agent
                )
            `)
            .neq('mode', 'Deathmatch')
            .order('started_at', { ascending: false })
            .limit(20);

        if (opError) throw opError;

        if (!operations || operations.length === 0) {
            console.log('ℹ️ Nenhuma operação encontrada para reprocessar.');
            return;
        }

        console.log(`📂 Encontradas ${operations.length} operações de squad.`);

        let processedCount = 0;
        let successCount = 0;

        for (const op of operations) {
            console.log(`\n--- 🎮 Partida: ${op.id} (${op.map_name}) ---`);
            const squad = op.operation_squads || [];
            
            for (const member of squad) {
                console.log(`   [→] Analisando: ${member.riot_id} (${member.agent})...`);
                
                const briefing = {
                    match_id: op.id,
                    player_id: member.riot_id,
                    map_name: op.map_name,
                    agent_name: member.agent
                };

                try {
                    const outcome = await processBriefing(briefing);
                    if (outcome.success) {
                        console.log(`   [✅] Sucesso: ${member.riot_id} (${outcome.insight?.model_used || "Local"})`);
                        successCount++;
                    } else {
                        console.error(`   [❌] Falha: ${member.riot_id}: ${outcome.error}`);
                    }
                } catch (innerErr) {
                    console.error(`   [❌] Erro crítico no worker para ${member.riot_id}:`, innerErr.message);
                }
                
                processedCount++;
                // Delay para não fritar o Ollama ou ser bloqueado pelo Scraper
                await new Promise(r => setTimeout(r, 2000));
            }
        }


        console.log('\n--- 🏁 REPROCESSAMENTO CONCLUÍDO ---');
        console.log(`Total de análises tentadas: ${processedCount}`);
        console.log(`Total de sucessos: ${successCount}`);
        console.log('-----------------------------------');

    } catch (err) {
        console.error('❌ Erro fatal no script de reprocessamento:', err.message);
    }
}

reprocess();
