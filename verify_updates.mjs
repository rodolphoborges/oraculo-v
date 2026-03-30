import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const MATCH_ID = 'f3211366-68db-479e-9c24-d55002e09913';

async function verify() {
    const { data: insights } = await supabase
        .from('ai_insights')
        .select('player_id, insight_resumo')
        .eq('match_id', MATCH_ID);
    
    if (!insights) return;

    for (const i of insights) {
        const res = JSON.parse(i.insight_resumo);
        console.log(`\n🔍 Verificando jogador: ${i.player_id}`);
        
        // 1. Verificação de Rank (Nova estrutura: Alpha, Omega ou Depósito de Torreta)
        const validRanks = ['Alpha', 'Omega', 'Depósito de Torreta'];
        const rankUsed = res.classification; // ImpactAnalyzer.calculate returns rank in .rank, but worker saves as .classification
        console.log(`- Rank/Classification: ${rankUsed} (${validRanks.includes(rankUsed) ? '✅ OK' : '❌ Falha'})`);

        // 2. Verificação de Nota (Nova precisão: 1 casa decimal, ex: 15.5)
        const score = res.nota_coach; 
        console.log(`- Nota Coach: ${score} (Geralmente derivada de impact.score / 15)`);

        // 3. Verificação de Diagnóstico (Presença de termos táticos do novo sistema)
        // O tom de voz agora usa [Keywords] que vêm das abilities/tags
        const diagnostico = res.diagnostico_principal;
        console.log(`- Amostra do Diagnóstico: "${diagnostico.substring(0, 100)}..."`);
        
        const hasTacticalTerms = diagnostico.toLowerCase().includes('entry') || 
                                diagnostico.toLowerCase().includes('trade') ||
                                diagnostico.toLowerCase().includes('shrouded') || // Omen
                                diagnostico.toLowerCase().includes('phoenix');
        console.log(`- Termos Táticos Detectados: ${hasTacticalTerms ? '✅ Sim' : '❌ Não'}`);
    }
}

verify();
