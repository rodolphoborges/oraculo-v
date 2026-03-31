
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const protocolUrl = process.env.PROTOCOL_SUPABASE_URL;
const protocolKey = process.env.PROTOCOL_SUPABASE_KEY;

const supabase = createClient(protocolUrl, protocolKey);

// Custom RPC to list columns or just use SQL via postgrest if possible (unlikely).
// I'll try to insert a fake record and see the keys or just guess from worker.js.
// Wait, I saw it in worker.js:
// { id, player_tag, match_id, status, error_msg, retry_count, retry_after, created_at }

async function addDummy() {
    const { data: inserted, error: insErr } = await supabase
        .from('match_analysis_queue')
        .insert([{
            match_id: '00000000-0000-0000-0000-000000000000',
            player_tag: 'DUMMY#TEST',
            status: 'pending'
        }])
        .select();

    if (insErr) {
        console.error('Error inserting dummy:', insErr.message);
    } else if (inserted && inserted.length > 0) {
        console.log('Sample record keys:', Object.keys(inserted[0]));
        // Cleanup
        await supabase.from('match_analysis_queue').delete().eq('player_tag', 'DUMMY#TEST');
    }
}

addDummy();
