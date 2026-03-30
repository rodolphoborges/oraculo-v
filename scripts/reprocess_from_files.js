import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { processBriefing } from '../worker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ANALYSES_DIR = path.join(__dirname, '../analyses');
const MATCHES_DIR = path.join(__dirname, '../matches');

const playerFilter = process.argv[2] ? process.argv[2].toLowerCase() : null;
const matchIdFilter = process.argv[3] || null;

async function reprocessFromFiles() {
    console.log(`🔄 [REPROCESS] Iniciando reprocessamento. Filtro: ${playerFilter || 'Nenhum'}`);

    const files = fs.readdirSync(ANALYSES_DIR).filter(f => f.startsWith('match_') && f.endsWith('.json'));
    console.log(`📂 Encontrados ${files.length} arquivos de análise.`);

    let successCount = 0;
    let failCount = 0;

    for (const file of files) {
        const filePath = path.join(ANALYSES_DIR, file);
        if (!fs.existsSync(filePath)) continue;

        let match_id, player_id;
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(content);
            player_id = data.player || data.agente_tag;
            // O match_id costuma estar no nome do arquivo: match_UUID_...
            match_id = file.split('_')[1];
            
            if (!match_id || !player_id) {
                console.log(`⚠️  Pulando ${file}: dados incompletos.`);
                continue;
            }
        } catch (e) {
            console.error(`❌ Erro ao ler ${file}: ${e.message}`);
            continue;
        }

        console.log(`\n⚙️  [PLAYER] ${player_id} | [MATCH] ${match_id}`);

        if (playerFilter && !player_id.toLowerCase().includes(playerFilter)) {
            console.log(`⏭️  Pulando (Filtro Player)`);
            continue;
        }

        if (matchIdFilter && match_id !== matchIdFilter) {
            continue;
        }

        // Verificar se temos os dados brutos
        const matchFile = path.join(MATCHES_DIR, `${match_id}.json`);
        if (!fs.existsSync(matchFile)) {
            console.log(`⚠️  Dados brutos não encontrados em ${match_id}.json. Tentando baixar via runAnalysis...`);
        }

        try {
            // briefing simulado
            const briefing = {
                match_id,
                player_id,
                source: 'reprocess_script'
            };

            // processBriefing cuida de runAnalysis + LLM + Supabase Update
            const result = await processBriefing(briefing);
            
            if (result.success) {
                console.log(`✅ Sucesso: ${match_id}`);
                successCount++;
            } else {
                console.log(`❌ Falha: ${result.error}`);
                failCount++;
            }
        } catch (err) {
            console.error(`💥 Erro fatal no processamento: ${err.message}`);
            failCount++;
        }

        // Delay para não sobrecarregar LLM/DB
        await new Promise(r => setTimeout(r, 500));
    }

    console.log(`\n✨ Concluído! Sucessos: ${successCount} | Falhas: ${failCount}`);
    process.exit(0);
}

reprocessFromFiles();
