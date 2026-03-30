import fs from 'fs';

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // SERVER.JS
    if (filePath === 'server.js') {
        // match_analysis_queue (UPSERT)
        content = content.replace(/player_id,/g, "player_tag: player_id,"); // Shorthand to explicit
        content = content.replace(/agente_tag: player_id,/g, "player_tag: player_id,");
        content = content.replace(/onConflict: 'match_id, agente_tag'/g, "onConflict: 'match_id, player_tag'");
        content = content.replace(/onConflict: 'match_id, player_id'/g, "onConflict: 'match_id, player_tag'");
        
        // admin stats mapping
        content = content.replace(/agente_tag: j\.agente_tag,/g, "agente_tag: j.player_tag,");
        content = content.replace(/agente_tag: j\.player_id,/g, "agente_tag: j.player_tag,");
    }

    // WORKER.JS
    if (filePath === 'worker.js') {
        // match_analysis_queue (POLLING)
        content = content.replace(/const \{ id, player_id, match_id \} = queueItem;/g, "const { id, player_tag: player_id, match_id } = queueItem;");
        content = content.replace(/const \{ id, agente_tag: player_id, match_id \} = queueItem;/g, "const { id, player_tag: player_id, match_id } = queueItem;");

        // ai_insights (SYNC) - Mantém player_id!
        content = content.replace(/player_tag: player_id,/g, "player_id: player_id,"); 
        content = content.replace(/onConflict: 'match_id, player_tag'/g, "onConflict: 'match_id, player_id'"); 

        // queue status update (ERROR)
        content = content.replace(/error: result\.error/g, "error_msg: result.error");
    }

    fs.writeFileSync(filePath, content);
    console.log(`✅ Arquivo ${filePath} corrigido com mapeamento final.`);
}

fixFile('server.js');
fixFile('worker.js');
