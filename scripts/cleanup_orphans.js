import { supabase } from '../lib/supabase.js';

const ORPHANS = ['Pitoco#auau', 'Cabeça02dodrill#0606'];

async function cleanup() {
    console.log(`🧹 [CLEANUP] Removendo análises órfãs: ${ORPHANS.join(', ')}...`);
    
    const { error, count } = await supabase
        .from('match_analysis_queue')
        .delete()
        .in('agente_tag', ORPHANS);

    if (error) {
        console.error("❌ Erro ao remover órfãos:", error.message);
    } else {
        console.log(`✅ Remoção concluída.`);
    }
}

cleanup();
