import { supabase } from './lib/supabase.js';

async function checkTables() {
    console.log("Checking 'players'...");
    const { data: pData, error: pError } = await supabase.from('players').select('count').limit(1);
    if (pError) console.error("players error:", pError.message);
    else console.log("players exists!");

    console.log("Checking 'operation_squads'...");
    const { data: oData, error: oError } = await supabase.from('operation_squads').select('count').limit(1);
    if (oError) console.error("operation_squads error:", oError.message);
    else console.log("operation_squads exists!");

    console.log("Checking 'match_analysis_queue'...");
    const { data: mData, error: mError } = await supabase.from('match_analysis_queue').select('count').limit(1);
    if (mError) console.error("match_analysis_queue error:", mError.message);
    else console.log("match_analysis_queue exists!");
}

checkTables();
