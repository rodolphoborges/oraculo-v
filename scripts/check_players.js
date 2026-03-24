import { supabaseProtocol } from './lib/supabase.js';

async function check() {
    const { data, error } = await supabaseProtocol
        .from('players')
        .select('riot_id')
        .ilike('riot_id', 'm4sna%');
    
    if (error) {
        console.error("❌ Erro:", error.message);
    } else {
        console.log("✅ Jogadores encontrados:", data.map(p => p.riot_id));
    }
}

check();
