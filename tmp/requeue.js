import { supabase } from '../lib/supabase.js';

async function req() {
    console.log("Re-enfileirando DefeitoDeFábrica#ZzZ...");
    await supabase.from('match_analysis_queue')
        .update({ status: 'pending', error_message: null })
        .eq('match_id', 'b56f4740-e11a-45d5-a966-6f58789ec616')
        .eq('agente_tag', 'DefeitoDeFábrica#ZzZ');
    console.log("Feito!");
}
req();
