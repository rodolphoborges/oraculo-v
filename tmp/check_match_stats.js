import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const protocolo = createClient(process.env.PROTOCOL_SUPABASE_URL, process.env.PROTOCOL_SUPABASE_KEY);

async function checkMatchStats() {
    console.log('Inspecionando colunas de match_stats...');
    const { data, error } = await protocolo.from('match_stats').select('*').limit(1);
    if (error) console.error(error.message);
    else console.log('Colunas de match_stats:', Object.keys(data[0] || {}));
}

checkMatchStats();
