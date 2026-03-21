import dotenv from 'dotenv';
dotenv.config({ quiet: true });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function listAll() {
    console.log("Supabase URL:", process.env.SUPABASE_URL);
    // Mascara o início da chave para segurança
    console.log("Supabase Key starts with:", process.env.SUPABASE_SERVICE_KEY?.substring(0, 15));

    // Como PostgREST oculta information_schema por padrão, tentamos deduzir testando nomes comuns
    const tablesToTest = ['players', 'match_analysis_queue', 'operation_squads', 'matches', 'players_beta'];
    
    console.log("\n--- Testing table presence ---");
    for (const table of tablesToTest) {
        const { data, error } = await supabase.from(table).select('count').limit(1);
        if (error) {
            console.log(`❌ Table '${table}': ${error.message}`);
            if (error.hint) console.log(`   Hint: ${error.hint}`);
        } else {
            console.log(`✅ Table '${table}': EXISTS`);
        }
    }
}

listAll();
