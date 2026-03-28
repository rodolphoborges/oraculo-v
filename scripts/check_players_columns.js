import { supabaseProtocol } from '../lib/supabase.js';

async function check() {
    const { data, error } = await supabaseProtocol
        .from('players')
        .select('*')
        .limit(1);
    
    if (error) {
        console.error("❌ Erro:", error.message);
    } else {
        console.log("✅ Colunas Players:", Object.keys(data[0] || {}));
    }
}

check();
