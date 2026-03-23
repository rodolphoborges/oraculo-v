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

    // 1. Buscar todos os registros completados
    const { data: jobs, error } = await supabase
        .from('match_analysis_queue')
        .select('*')
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("❌ Erro ao buscar dados:", error.message);
        return;
    }

    // 2. Organizar por jogador
    const database = {};
    jobs.forEach(job => {
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

    // 3. Salvar na pasta do portal
    const portalDir = path.resolve('static_portal');
    if (!fs.existsSync(portalDir)) {
        fs.mkdirSync(portalDir);
    }

    const dataPath = path.join(portalDir, 'data.js');
    fs.writeFileSync(dataPath, `const ORACULO_DATABASE = ${JSON.stringify(database, null, 2)};`);

    console.log(`✅ Exportados ${jobs.length} registros para ${dataPath}`);
    console.log(`👥 Total de jogadores únicos: ${Object.keys(database).length}`);
}

exportData();
