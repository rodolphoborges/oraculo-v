import { supabaseProtocol } from './lib/supabase.js';
import fs from 'fs';
import path from 'path';

async function syncExistingReport(matchId, playerId) {
    const fileName = `match_${matchId}_${playerId.replace('#', '_')}.json`;
    const filePath = path.join(process.cwd(), 'analyses', fileName);

    if (!fs.existsSync(filePath)) {
        console.error(`❌ [ERROR] File not found: ${filePath}`);
        return;
    }

    try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const reportData = JSON.parse(fileContent);

        console.log(`🚀 [SYNC] Syncing report for ${playerId} in match ${matchId}...`);

        // Prepare the upsert data
        const upsertData = {
            player_id: playerId,
            match_id: matchId,
            insight_resumo: JSON.stringify(reportData.conselho_kaio || {}),
            analysis_report: reportData, // HERE IS THE FIX: Full report object
            model_used: "MANUAL_SYNC_FIX",
            created_at: new Date().toISOString()
        };

        const { error } = await supabaseProtocol
            .from('ai_insights')
            .upsert([upsertData], { onConflict: 'match_id, player_id' });

        if (error) {
            console.error(`❌ [ERROR] Failed to upload to Supabase: ${error.message}`);
        } else {
            console.log(`✅ [SUCCESS] Report synced for ${playerId}`);
        }
    } catch (err) {
        console.error(`❌ [ERROR] Unexpected error: ${err.message}`);
    }
}

async function main() {
    const matchId = 'e8342d3a-166f-43b5-a127-76e8b7a8a9e7';
    const players = ['mwzeraDaShopee#s2s2', 'ALEGRIA#021'];

    for (const player of players) {
        await syncExistingReport(matchId, player);
    }
}

main();
