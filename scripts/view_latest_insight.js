/**
 * scripts/view_latest_insight.js
 * 
 * Utilitário para ler o último relatório de IA gerado no Supabase.
 */
import { supabase } from '../lib/supabase.js';

async function viewLatest() {
    console.log("🔍 [IA] Buscando o último relatório gerado no banco de dados...");

    const { data, error } = await supabase
        .from('ai_insights')
        .select(`
            player_id,
            match_id,
            model_used,
            created_at,
            insight_resumo
        `)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error) {
        console.error("❌ Erro ao buscar insight:", error.message);
        return;
    }

    if (!data) {
        console.log("⚠️ Nenhum insight encontrado no banco.");
        return;
    }

    console.log(`\n=================================================`);
    console.log(`📡 RELATÓRIO DO HEAD COACH (IA)`);
    console.log(`-------------------------------------------------`);
    console.log(`Atleta:    ${data.player_id}`);
    console.log(`Partida:   ${data.match_id}`);
    console.log(`Motor:     ${data.model_used}`);
    console.log(`Data/Hora: ${new Date(data.created_at).toLocaleString('pt-BR')}`);
    console.log(`-------------------------------------------------`);
    console.log(`📋 DIAGNÓSTICO:`);
    console.log(`   ${data.insight_resumo.diagnostico_principal}`);
    console.log(`\n🏹 TÁTICA:`);
    console.log(`   ${data.insight_resumo.tatico}`);
    console.log(`\n🎯 FOCO DE TREINO:`);
    data.insight_resumo.foco_treino.forEach(d => console.log(`   - ${d}`));
    console.log(`\n⭐ NOTA COACH: ${data.insight_resumo.nota_coach}/10`);
    console.log(`=================================================\n`);
}

viewLatest();
