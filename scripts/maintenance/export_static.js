import { supabase } from './lib/supabase.js';
import fs from 'fs';
import path from 'path';

/**
 * export_static.js
 * 
 * Exporta todos os dados do Oráculo-V para um único arquivo JSON
 * para ser utilizado em um portal estático (sem servidor).
 * 
 * [MIGRAÇÃO 2026-03-30]: Tabela match_analysis_queue foi movida/deletada. 
 * Agora consultamos 'ai_insights' e 'match_stats' do banco local.
 */

async function exportData() {
    console.log("📦 Exportando dados para o Portal Estático (Modo Decoupled)...");

    // 1. Buscar todos os insights concluídos (Análise Final)
    const { data: insights, error: iError } = await supabase
        .from('ai_insights')
        .select(`
            id,
            match_id,
            player_id,
            insight_resumo,
            model_used,
            created_at
        `)
        .order('created_at', { ascending: false });

    // 2. Buscar estatísticas técnicas (Dashboard de Operações)
    const { data: stats, error: sError } = await supabase
        .from('match_stats')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

    if (iError || sError) {
        console.error("❌ Erro ao buscar dados (Verifique se as tabelas ai_insights/match_stats existem):", iError?.message || sError?.message);
        return;
    }

    // 3. Organizar por jogador (Agentes) para o Oráculo Database
    const database = {};
    
    // Processamos os insights como fonte de verdade para análises
    insights.forEach(insight => {
        const tag = insight.player_id;
        if (!database[tag]) {
            database[tag] = {
                tag: tag,
                matches: []
            };
        }
        
        // Tenta encontrar o stats correspondente para enriquecer a visualização
        const matchStat = stats.find(s => s.match_id === insight.match_id && s.player_id === tag);

        database[tag].matches.push({
            id: insight.id,
            matchId: insight.match_id,
            timestamp: insight.created_at,
            analysis: {
                ...(insight.insight_resumo || {}),
                agent: matchStat?.agent || "Combatente",
                map: matchStat?.map_name || "Arena Desconhecida",
                performance_index: matchStat?.impact_score || matchStat?.acs || "N/A",
                kd: matchStat ? (matchStat.kills / Math.max(matchStat.deaths, 1)).toFixed(2) : "---",
                adr: matchStat?.adr || "---",
                acs: matchStat?.acs || "---",
                performance_status: insight.insight_resumo?.diagnostico_principal ? "COMPLETO" : "SIMPLIFICADO"
            }
        });
    });

    // 4. Mapear para o formato ORACULO_OPERATIONS (Histórico de Fila Simulado)
    // Como a fila real não está mais aqui, usamos os logs de stats para mostrar atividade
    const operations = stats.map(s => {
        const hasInsight = insights.some(i => i.match_id === s.match_id && i.player_id === s.player_id);
        return {
            id: s.id,
            match_id: s.match_id,
            agente_tag: s.player_id,
            status: hasInsight ? 'completed' : 'processing',
            created_at: s.created_at,
            processed_at: s.created_at,
            metadata: {
                agent: s.agent,
                map: s.map_name
            }
        };
    });

    // 5. Salvar na pasta do portal
    const portalDir = path.resolve('static_portal');
    if (!fs.existsSync(portalDir)) {
        fs.mkdirSync(portalDir);
    }

    const dataPath = path.join(portalDir, 'data.js');
    const content = `// ESTE ARQUIVO É GERADO AUTOMATICAMENTE - NÃO EDITE
const ORACULO_DATABASE = ${JSON.stringify(database, null, 2)};
const ORACULO_OPERATIONS = ${JSON.stringify(operations, null, 2)};`;

    fs.writeFileSync(dataPath, content);

    console.log(`✅ Exportados ${insights.length} insights e ${operations.length} operações para ${dataPath}`);
    console.log(`👥 Total de jogadores únicos: ${Object.keys(database).length}`);
}

exportData();
