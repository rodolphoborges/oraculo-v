
import { processBriefing } from './worker.js';
import { supabase } from './lib/supabase.js';

async function testOne() {
    console.log('🧪 Iniciando TESTE de um job...');
    const { data: jobs, error } = await supabase
        .from('match_analysis_queue')
        .select('*')
        .eq('status', 'processing')
        .limit(1);

    if (error || !jobs || jobs.length === 0) {
        console.log('❌ Nenhum job em processamento encontrado.');
        return;
    }

    const job = jobs[0];
    console.log(`📡 Testando Job ID: ${job.id} | Player: ${job.player_tag}`);
    
    try {
        const result = await processBriefing({
            match_id: job.match_id,
            player_id: job.player_tag,
            metadata: job.metadata
        });
        console.log('✅ Resultado:', result);
    } catch (e) {
        console.error('❌ Erro no teste:', e);
    }
}

testOne();
