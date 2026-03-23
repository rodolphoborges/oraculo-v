import { supabase } from './lib/supabase.js';

/**
 * verify_sanitization.js
 * 
 * Verifica se os registros reprocessados possuem as novas métricas e nomenclatura.
 */

async function verify() {
    console.log("🔍 Verificando Sanitização da Base (Amostra de 3 registros)...\n");

    const { data: samples, error } = await supabase
        .from('match_analysis_queue')
        .select('agente_tag, match_id, metadata->analysis')
        .eq('status', 'completed')
        .limit(3);

    if (error) {
        console.error("❌ Erro ao buscar amostra:", error.message);
        return;
    }

    samples.forEach((sample, i) => {
        const analysis = sample.analysis;
        console.log(`--- [Amostra ${i+1}] ---`);
        console.log(`Jogador: ${sample.agente_tag}`);
        console.log(`Status: ${analysis.performance_status}`);
        console.log(`FK (First Bloods): ${analysis.first_kills || analysis.first_bloods}`);
        console.log(`FD (First Deaths): ${analysis.first_deaths}`);
        console.log(`ADR (Dano Médio): ${analysis.adr}`);
        console.log(`Partidas Antecedentes: ${analysis.matches_analyzed}`);
        console.log(`Conselho: ${analysis.conselho_kaio}`);
        console.log("------------------------\n");
    });

    console.log("✅ Se os campos acima estão preenchidos com termos como 'ABAIXO DO RADAR' ou 'ELITE', a sanitização foi um sucesso.");
}

verify();
