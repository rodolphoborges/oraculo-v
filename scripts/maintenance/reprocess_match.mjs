import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const supabaseProtocol = createClient(process.env.PROTOCOL_SUPABASE_URL, process.env.PROTOCOL_SUPABASE_KEY);

const MATCH_ID = 'f3211366-68db-479e-9c24-d55002e09913';

async function reprocess() {
    console.log(`🔍 Buscando jogadores da partida ${MATCH_ID}...`);
    
    // Busca na tabela de estatísticas consolidada do Oráculo
    const { data: stats, error: statsErr } = await supabase
        .from('match_stats')
        .select('player_id')
        .eq('match_id', MATCH_ID);

    if (statsErr) {
        console.error("Erro ao buscar estatísticas:", statsErr);
        return;
    }

    if (!stats || stats.length === 0) {
        console.log("Nenhuma análise encontrada para esta partida no Oráculo.");
        return;
    }

    const playerIds = stats.map(s => s.player_id);
    console.log(`🎯 Jogadores encontrados: ${playerIds.join(', ')}`);

    console.log("🔄 Resetando fila de análise...");
    
    for (const player_id of playerIds) {
        const { error: updateErr } = await supabaseProtocol
            .from('match_analysis_queue')
            .update({ 
                status: 'pending', 
                error_msg: null, 
                retry_count: null, 
                retry_after: null,
                updated_at: new Date().toISOString()
            })
            .match({ match_id: MATCH_ID, player_tag: player_id });

        if (updateErr) {
            console.warn(`⚠️ Erro ao atualizar fila para ${player_id}:`, updateErr.message);
            // Tenta inserir se não existir? (geralmente já existe se foi processado)
        } else {
            console.log(`✅ Fila resetada para ${player_id}`);
        }
    }

    console.log("\n🚀 Iniciando processamento imediato...");
    // Importa o worker dinamicamente
    const { processBriefing } = await import('./worker.js');

    for (const player_id of playerIds) {
        console.log(`\n⚙️  Reprocessando ${player_id}...`);
        const result = await processBriefing({ 
            match_id: MATCH_ID, 
            player_id, 
            map_name: null, 
            agent_name: null 
        });

        if (result.success) {
            console.log(`✅ Sucesso para ${player_id}: ${result.insight.resumo}`);
        } else {
            console.error(`❌ Falha para ${player_id}:`, result.error);
        }
    }
}

reprocess();
