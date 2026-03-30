import fs from 'fs';

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 1. Substituir nos upserts/inserts do match_analysis_queue
    // Procura por blocos que enviem player_id para essa tabela
    // Ex: .from('match_analysis_queue').upsert([{ ... player_id, ... }])
    
    // Regex para encontrar o player_id dentro de um array de objetos passando para match_analysis_queue
    const regex1 = /supabaseProtocol\.from\('match_analysis_queue'\)\.upsert\(\[\{\s+match_id,\s+player_id,/g;
    content = content.replace(regex1, "supabaseProtocol.from('match_analysis_queue').upsert([{\n        match_id,\n        agente_tag: player_id,");

    // Regex para o onConflict
    const regex2 = /\{ onConflict: 'match_id, player_id' \}/g;
    content = content.replace(regex2, "{ onConflict: 'match_id, agente_tag' }");

    // 2. No worker.js (extração de campos)
    const regex3 = /const \{ id, player_id, match_id \} = queueItem;/g;
    content = content.replace(regex3, "const { id, agente_tag: player_id, match_id } = queueItem;");

    // 3. No admin api mapping
    const regex4 = /agente_tag: j\.player_id,/g;
    content = content.replace(regex4, "agente_tag: j.agente_tag,");

    fs.writeFileSync(filePath, content);
    console.log(`✅ Arquivo ${filePath} processado.`);
}

fixFile('server.js');
fixFile('worker.js');
