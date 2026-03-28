import { supabase, supabaseProtocol } from '../lib/supabase.js';

async function resetTacticalLayer() {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    console.log(`🧹 RESET TÁTICO INICIADO (Since: ${fortyEightHoursAgo})`);

    // 1. Limpar AI Insights em ambas as bases
    console.log('🗑️ Apagando todos os AI Insights (Total)...');
    const { error: del1 } = await supabase.from('ai_insights').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Truncate via delete
    if (del1) console.error('❌ Erro no Oráculo:', del1.message);

    if (supabaseProtocol) {
        const { error: del2 } = await supabaseProtocol.from('ai_insights').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (del2) console.error('❌ Erro no Protocolo:', del2.message);
    }

    // 2. Marcar como "Skipped" (Concluído sem análise) tudo que for antigo (> 48h)
    console.log('🧊 Congelando histórico antigo (> 48h)...');
    const { error: skipError } = await supabase
        .from('match_analysis_queue')
        .update({ 
            status: 'completed', 
            error_message: 'Skipped - Historical Only (Tactical Reset Phase 1)' 
        })
        .lt('created_at', fortyEightHoursAgo)
        .neq('status', 'completed'); // Só o que não estava pronto
    
    if (skipError) console.error('❌ Erro ao congelar histórico:', skipError.message);

    // 3. Resetar as últimas 48h para pending
    console.log('📥 Re-enfileirando partidas das últimas 48h para reprocessamento...');
    const { error: resetError } = await supabase
        .from('match_analysis_queue')
        .update({ 
            status: 'pending',
            processed_at: null,
            error_message: null
        })
        .gte('created_at', fortyEightHoursAgo);

    if (resetError) console.error('❌ Erro ao resetar fila 48h:', resetError.message);

    console.log('✅ RESET CONCLUÍDO. O sistema agora focará apenas nas últimas 48h com os novos dados oficiais.');
}

resetTacticalLayer();
