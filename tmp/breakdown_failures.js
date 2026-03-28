import { supabase } from '../lib/supabase.js';

async function breakdownFailures() {
    const { data: failures, error } = await supabase
        .from('match_analysis_queue')
        .select('error_message')
        .eq('status', 'failed');

    if (error) {
        console.error('❌ Erro:', error.message);
        return;
    }

    const counts = {};
    failures.forEach(f => {
        const msg = (f.error_message || 'Erro Desconhecido').split(':')[0]; // Group by first part of error
        counts[msg] = (counts[msg] || 0) + 1;
    });

    console.log('📊 BREAKDOWN DE FALHAS (Agrupado):');
    console.log(JSON.stringify(counts, null, 2));

    console.log('\n--- ÚLTIMAS 10 MENSAGENS REAIS ---');
    failures.slice(-10).forEach(f => console.log(`- ${f.error_message}`));
}

breakdownFailures();
