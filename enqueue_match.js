import { supabase } from './lib/supabase.js';

async function enqueue() {
    const matchId = 'b9bddd5e-350d-4b65-8735-12e995645767';
    const playerTag = 'm4sna#chama';

    console.log(`🚀 [ENQUEUE] Adicionando partida ${matchId} para ${playerTag}...`);

    const { data, error } = await supabase
        .from('match_analysis_queue')
        .insert([{ 
            match_id: matchId, 
            agente_tag: playerTag, 
            status: 'pending' 
        }])
        .select();

    if (error) {
        console.error("❌ Erro ao enfileirar:", error.message);
    } else {
        console.log("✅ Partida enfileirada com sucesso!", data);
        console.log("Inicie o worker (node worker.js) para processar.");
    }
}

enqueue();
