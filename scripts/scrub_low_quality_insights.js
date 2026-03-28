import { supabase, supabaseProtocol } from '../lib/supabase.js';

const BANNED_TERMS = ['menear', 'pratele', 'alinharmos', 'instâncias', 'croixhair', 'punkts', 'energia', 'estímulos', 'initiativa', 'group', 'positioning', 'missions'];

async function run() {
    console.log("🔍 [SCRUB] Iniciando varredura de laudos de baixa qualidade...");
    
    const { data: insights, error } = await supabase.from('ai_insights').select('id, match_id, player_id, insight_resumo');
    
    if (error) {
        console.error("❌ Erro ao buscar insights:", error.message);
        return;
    }

    let count = 0;
    for (const row of insights) {
        const text = JSON.stringify(row.insight_resumo).toLowerCase();
        const found = BANNED_TERMS.filter(term => text.includes(term));
        
        if (found.length > 0) {
            console.log(`🧹 Removendo insight: [${row.player_id}] em ${row.match_id} (Termos: ${found.join(', ')})`);
            
            // Remover do Oráculo
            await supabase.from('ai_insights').delete().eq('id', row.id);
            
            // Remover do Protocolo-V
            if (supabaseProtocol) {
                await supabaseProtocol.from('ai_insights').delete()
                    .eq('match_id', row.match_id)
                    .eq('player_id', row.player_id);
            }
            
            // Resetar status na fila para forçar reprocessamento
            await supabase.from('match_analysis_queue')
                .update({ 
                    status: 'pending', 
                    error_message: 'Laudo removido por baixa qualidade técnica (Filtro Tático).' 
                })
                .eq('match_id', row.match_id)
                .eq('agente_tag', row.player_id);
            
            count++;
        }
    }
    
    console.log(`\n✅ [SUCESSO] ${count} laudos de baixa qualidade removidos. Fila atualizada para reprocessamento.`);
}

run();
