import { supabase } from './lib/supabase.js';
import fs from 'fs';
import path from 'path';

/**
 * export_static.js
 * 
 * Exporta todos os dados do Oráculo-V para um único arquivo JSON
 * para ser utilizado em um portal estático (sem servidor).
 */

async function exportData() {
    console.log("📦 Exportando dados para o Portal Estático...");

    // 1. Buscar todos os registros completados para os Agentes
    const { data: completedJobs, error: cError } = await supabase
        .from('match_analysis_queue')
        .select('*')
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

    // 2. Buscar histórico recente de TODA a fila para o Dashboard de Operações
    const { data: allJobs, error: aError } = await supabase
        .from('match_analysis_queue')
        .select('id, match_id, agente_tag, status, created_at, processed_at, metadata, error_message')
        .order('created_at', { ascending: false })
        .limit(100);

    if (cError || aError) {
        console.error("❌ Erro ao buscar dados:", cError?.message || aError?.message);
        return;
    }

    // 3. Organizar por jogador (Agentes)
    const database = {};
    completedJobs.forEach(job => {
        const tag = job.agente_tag;
        if (!database[tag]) {
            database[tag] = {
                tag: tag,
                matches: []
            };
        }
        database[tag].matches.push({
            id: job.id,
            matchId: job.match_id,
            timestamp: job.created_at,
            analysis: job.metadata.analysis
        });
    });

    // 4. Salvar na pasta do portal
    const portalDir = path.resolve('static_portal');
    if (!fs.existsSync(portalDir)) {
        fs.mkdirSync(portalDir);
    }

    const dataPath = path.join(portalDir, 'data.js');
    const content = `// ESTE ARQUIVO É GERADO AUTOMATICAMENTE - NÃO EDITE
const ORACULO_DATABASE = ${JSON.stringify(database, null, 2)};
const ORACULO_OPERATIONS = ${JSON.stringify(allJobs, null, 2)};`;

    fs.writeFileSync(dataPath, content);

    console.log(`✅ Exportados ${completedJobs.length} registros e histórico de operações para ${dataPath}`);
    console.log(`👥 Total de jogadores únicos: ${Object.keys(database).length}`);
}

exportData();
