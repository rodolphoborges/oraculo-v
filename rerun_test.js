import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { spawnSync } from 'child_process';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function rerun() {
    const player = "OUSADIA#013";
    const matchId = "5525faf5-034e-4caf-b142-9d9bc8a3e897";

    console.log(`🧹 [TEST] Limpando job anterior para ${player}...`);
    await supabase.from('match_analysis_queue').delete().eq('match_id', matchId).eq('agente_tag', player);

    console.log(`📥 [TEST] Enfileirando novamente (v2.0 com Constituição)...`);
    const { data: job } = await supabase.from('match_analysis_queue').insert([{
        match_id: matchId,
        agente_tag: player,
        status: 'pending'
    }]).select().single();

    if (job) {
        console.log(`🚀 [TEST] Iniciando Worker para processar Job ID: ${job.id}`);
        spawnSync('node', ['worker.js'], { stdio: 'inherit' });
        console.log(`✅ [TEST] Processamento concluído! Abra o Dashboard.`);
    }
}

rerun();
