import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const MATCH_ID = 'f3211366-68db-479e-9c24-d55002e09913';

async function check() {
    const { data: insights } = await supabase
        .from('ai_insights')
        .select('player_id, created_at, insight_resumo')
        .eq('match_id', MATCH_ID);
    
    console.log(`🔎 Total insights for ${MATCH_ID}: ${insights ? insights.length : 0}`);
    if (insights) {
        insights.forEach(i => {
            const parsed = JSON.parse(i.insight_resumo);
            console.log(`- ${i.player_id}: [${i.created_at}] ${parsed.diagnostico_principal.substring(0, 50)}...`);
        });
    }
}

check();
