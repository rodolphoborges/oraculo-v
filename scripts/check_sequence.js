import { supabase } from '../lib/supabase.js';

async function check() {
    const { data, error } = await supabase
        .from('match_analysis_queue')
        .select('match_id, created_at, status')
        .eq('agente_tag', 'm4sna#chama')
        .order('created_at', { ascending: true });
    
    if (error) {
        console.error("❌ Erro:", error.message);
    } else {
        const index = data.findIndex(m => m.match_id === '2c7944be-f3c4-4429-a0fa-8d3604acd7a7');
        console.log(`📊 Posição da partida na cronologia: ${index + 1} de ${data.length}`);
        console.log("📊 Primeiras 5 partidas:", data.slice(0, 5).map(m => ({ id: m.match_id, status: m.status })));
    }
}

check();
