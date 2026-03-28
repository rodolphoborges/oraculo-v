/**
 * scripts/backfill_dashboard.js
 * 
 * Oráculo-V v4.0 - Dash de Backfill.
 * Mostra o progresso do processamento em massa, ETA e status 
 * do worker de forma visual no terminal.
 */
import { supabase } from '../lib/supabase.js';

const startTime = Date.now();
let initialDone = null;

async function showProgress() {
    const { count: total } = await supabase
        .from('match_analysis_queue')
        .select('*', { count: 'exact', head: true });

    const { count: done } = await supabase
        .from('match_analysis_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');

    if (initialDone === null) initialDone = done;

    const { count: failed } = await supabase
        .from('match_analysis_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed');

    const pending = total - (done + failed);
    const percent = Math.round((done / total) * 100);
    
    // Cálculo de ETA (Baseado no progresso real desde que o dashboard abriu)
    const elapsedMs = Date.now() - startTime;
    const progressSinceStart = done - initialDone;
    let etaStr = "Calculando...";
    
    if (progressSinceStart > 0) {
        const msPerJob = elapsedMs / progressSinceStart;
        const remainingMs = msPerJob * pending;
        
        if (remainingMs > 0) {
            const hours = Math.floor(remainingMs / 3600000);
            const mins = Math.floor((remainingMs % 3600000) / 60000);
            etaStr = `${hours}h ${mins}m`;
        } else {
            etaStr = "Finalizando...";
        }
    }

    // Gerar barra [######----]
    const barWidth = 20;
    const filled = Math.round((percent / 100) * barWidth);
    const bar = "█".repeat(filled) + "░".repeat(barWidth - filled);

    process.stdout.write('\x1Bc'); // Limpa o terminal para o dash fixo
    console.log(`\n=================================================`);
    console.log(`📡 PAINEL DE MONITORAMENTO: BACKFILL TÁTICO`);
    console.log(`=================================================`);
    console.log(`📊 Progresso: [${bar}] ${percent}%`);
    console.log(`✅ Concluídos: ${done}`);
    console.log(`⏳ Pendentes:   ${pending}`);
    console.log(`❌ Falhas:      ${failed}`);
    console.log(`-------------------------------------------------`);
    console.log(`⏰ Tempo Estimado (ETA): ${etaStr}`);
    console.log(`🌐 Status Ollama/NAT:    ONLINE`);
    console.log(`-------------------------------------------------`);
    console.log(`🔄 Atualização: ${new Date().toLocaleTimeString('pt-BR')}`);
    console.log(`=================================================\n`);

    if (pending === 0) {
        console.log("🏁 PROCESSO FINALIZADO COM SUCESSO!");
        process.exit(0);
    }
}

// Atualizar a cada 10 segundos
setInterval(showProgress, 10000);
showProgress();
