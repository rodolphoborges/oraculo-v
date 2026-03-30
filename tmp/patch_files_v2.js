import fs from 'fs';

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 1. Substituir nos upserts/inserts do match_analysis_queue
    // A versão anterior do patch tinha colocado agente_tag: player_id,
    content = content.replace(/agente_tag: player_id,/g, "player_tag: player_id,");
    content = content.replace(/onConflict: 'match_id, agente_tag'/g, "onConflict: 'match_id, player_tag'");

    // 2. No worker.js (extração de campos)
    content = content.replace(/const \{ id, agente_tag: player_id, match_id \} = queueItem;/g, "const { id, player_tag: player_id, match_id } = queueItem;");

    // 3. No admin api mapping (server.js)
    content = content.replace(/agente_tag: j\.agente_tag,/g, "agente_tag: j.player_tag,");

    // 4. No worker.js (error field)
    content = content.replace(/error: result\.error/g, "error_msg: result.error");

    fs.writeFileSync(filePath, content);
    console.log(`✅ Arquivo ${filePath} corrigido para player_tag.`);
}

fixFile('server.js');
fixFile('worker.js');
