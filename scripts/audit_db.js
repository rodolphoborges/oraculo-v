import { supabase } from './lib/supabase.js';

async function audit() {
    console.log("🔍 [AUDIT] Iniciando varredura global de sanidade...");
    const { data: completedJobs, error } = await supabase
        .from('match_analysis_queue')
        .select('id, match_id, agente_tag, metadata')
        .eq('status', 'completed');

    if (error) {
        console.error("Erro no audit:", error);
        return;
    }

    console.log(`📊 Analisando ${completedJobs.length} partidas concluídas...`);
    
    // Como o modo não está em uma coluna, teríamos que baixar o JSON de cada uma 
    // ou confiar no metadata se o salvamos lá.
    // Vamos checar os primeiros 5 para ver se o 'mode' está no metadata.
    completedJobs.slice(0, 5).forEach(j => {
        console.log(`Job ${j.id}:`, JSON.stringify(j.metadata, null, 2).substring(0, 200) + "...");
    });
}
audit();
