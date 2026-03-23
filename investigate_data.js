import { supabase, supabaseProtocol } from './lib/supabase.js';

async function investigate() {
    console.log("🔍 Iniciando Investigação de Dados...\n");

    // 1. Estado da Fila (Oráculo-V)
    const { data: queueData, error: queueError } = await supabase
        .from('match_analysis_queue')
        .select('status, error_message, agente_tag, match_id');

    if (queueError) {
        console.error("❌ Erro ao buscar fila:", queueError.message);
    } else {
        const stats = queueData.reduce((acc, curr) => {
            acc[curr.status] = (acc[curr.status] || 0) + 1;
            return acc;
        }, {});
        console.log("📊 Resumo da Fila (Oráculo-V):", stats);

        const failed = queueData.filter(j => j.status === 'failed');
        if (failed.length > 0) {
            console.log(`\n❌ Total de Falhas: ${failed.length}`);
            console.log("Amostra de erros:");
            failed.slice(0, 5).forEach(f => {
                console.log(` - [${f.agente_tag}] match ${f.match_id}: ${f.error_message?.slice(0, 60)}...`);
            });
        }
    }

    // 2. Estado dos Jogadores (Protocolo-V)
    const { count: playerCount, error: playerError } = await supabaseProtocol
        .from('players')
        .select('*', { count: 'exact', head: true });

    if (playerError) {
        console.error("❌ Erro ao buscar jogadores:", playerError.message);
    } else {
        console.log(`\n👤 Total de Jogadores (Protocolo-V): ${playerCount}`);
        
        // Verificar Holt states 0.0 ou null
        const { data: trendIssues } = await supabaseProtocol
            .from('players')
            .select('riot_id, performance_l, performance_t')
            .or('performance_l.eq.0,performance_t.eq.0');
        
        if (trendIssues && trendIssues.length > 0) {
            console.log(`⚠️ Jogadores com tendências possivelmente zeradas (L ou T = 0): ${trendIssues.length}`);
        }
    }

    // 3. Verificar Duplicatas na Fila
    const duplicates = [];
    const seen = new Set();
    queueData?.forEach(j => {
        const key = `${j.agente_tag}:${j.match_id}`;
        if (seen.has(key)) {
            duplicates.push(key);
        }
        seen.add(key);
    });

    if (duplicates.length > 0) {
        console.log(`\n👯 Duplicatas detectadas na fila (Tag:Match): ${duplicates.length}`);
        console.log("Amostra:", duplicates.slice(0, 3));
    } else {
        console.log("\n✅ Nenhuma duplicata detectada na fila.");
    }

    // 4. Verificar se há partidas em Protocolo-V (jogadores ativos) que não foram processadas?
    // Isso é mais complexo pois as partidas costumam vir do Radar.
    // Mas podemos ver se há 'processing' travados (antigos).
    const now = new Date();
    const { data: stuckJobs } = await supabase
        .from('match_analysis_queue')
        .select('id, agente_tag, match_id, processed_at')
        .eq('status', 'processing');
    
    const longRunning = stuckJobs?.filter(j => {
        const processedAt = new Date(j.processed_at);
        return (now - processedAt) > 1000 * 60 * 10; // Mais de 10 min
    });

    if (longRunning && longRunning.length > 0) {
        console.log(`\n⏳ Jobs travados em 'processing' (>10min): ${longRunning.length}`);
    }

    console.log("\n🏁 Investigação Finalizada.");
}

investigate();
