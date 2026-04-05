import { supabase, supabaseProtocol } from './lib/supabase.js';

const BANNED_TERMS = ['menear', 'pratele', 'alinharmos', 'instâncias', 'croixhair', 'punkts', 'energia', 'estímulos', 'initiativa', 'group', 'positioning', 'missions'];

function isLowQuality(insight) {
    if (!insight) return true;
    
    // Stringify if it's an object (it's stored as JSON in the database usually, but Postgrest might return it as object or string depending on column type)
    const insightText = typeof insight === 'string' ? insight : JSON.stringify(insight);
    
    // Check for non-Latin characters
    if (/[^\x00-\x7F\u00C0-\u017F\s.,!?:;"'()\[\]\n\r]/.test(insightText)) {
        return true;
    }

    const lower = insightText.toLowerCase();
    const found = BANNED_TERMS.filter(term => lower.includes(term));
    if (found.length > 0) {
        return true;
    }

    return false;
}

async function auditDB(name, client) {
    if (!client) {
        console.log(`⚠️ [AUDIT] Cliente para ${name} não disponível.`);
        return [];
    }
    console.log(`🔍 [AUDIT] Verificando insights na base ${name}...`);
    
    const { data: insights, error } = await client
        .from('ai_insights')
        .select('*');

    if (error) {
        console.error(`❌ Erro em ${name}: ${error.message}`);
        return [];
    }

    const badOnes = insights.filter(i => isLowQuality(i.insight_resumo));
    console.log(`📊 ${name}: ${insights.length} totais, ${badOnes.length} baixos.`);
    return badOnes;
}

async function main() {
    const badOraculo = await auditDB('ORÁCULO-V', supabase);
    const badProtocol = await auditDB('PROTOCOLO-V', supabaseProtocol);

    const allBad = [...badOraculo, ...badProtocol];
    
    if (allBad.length > 0) {
        console.log(`\n🚨 Total de ${allBad.length} insights problemáticos encontrados.`);
        // List unique matches to re-process
        const reprocess = new Set();
        allBad.forEach(i => reprocess.add(`${i.match_id}|${i.player_id}`));
        
        console.log(`♻️ Necessário re-processar ${reprocess.size} entradas únicas.`);
        for (const item of reprocess) {
            console.log(`  - ${item}`);
        }
    } else {
        console.log("✅ Nenhum insight de baixa qualidade detectado.");
    }
}

main();
