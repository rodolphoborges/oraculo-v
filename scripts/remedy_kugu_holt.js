import { supabase, supabaseProtocol } from '../lib/supabase.js';

async function remedy() {
    const agenteTag = 'kugutsuhasu#2145';
    console.log(`🛠️ [REMEDY] Corrigindo Holt-Winters para ${agenteTag}...`);

    // 1. Garantir que metadados tenham 'perf' no nível superior (necessário para o worker carregar)
    const { data: jobs, error: err1 } = await supabase
        .from('match_analysis_queue')
        .select('*')
        .eq('agente_tag', agenteTag)
        .eq('status', 'completed');

    if (err1) throw err1;

    console.log(`🔍 Higienizando metadados de ${jobs.length} jobs...`);
    for (const job of jobs) {
        if (!job.metadata.perf && job.metadata.analysis && job.metadata.analysis.performance_index) {
            console.log(`✨ Restaurando 'perf' no ID ${job.id}`);
            await supabase.from('match_analysis_queue').update({
                metadata: {
                    ...job.metadata,
                    perf: job.metadata.analysis.performance_index,
                    agent: job.metadata.analysis.agent,
                    map: job.metadata.analysis.map
                }
            }).eq('id', job.id);
        }
    }

    // 2. Calcular Holt Inicial (Média das 3 primeiras)
    const { data: matches, error: err2 } = await supabase
        .from('match_analysis_queue')
        .select('metadata->perf, metadata->analysis->kd, metadata->analysis->adr')
        .eq('agente_tag', agenteTag)
        .eq('status', 'completed')
        .order('id', { ascending: true }) // Tie breaker
        .limit(3);

    if (err2) throw err2;

    if (matches && matches.length === 3) {
        console.log(`🧠 [WORKER-EMU] Inicializando Holt para ${agenteTag} com base em 3 partidas.`);
        
        // Ensure values are numbers (Supabase -> JSON might return strings)
        const perf0 = parseFloat(matches[0].perf);
        const perf1 = parseFloat(matches[1].perf);
        const perf2 = parseFloat(matches[2].perf);
        
        const kd0 = parseFloat(matches[0].kd);
        const kd1 = parseFloat(matches[1].kd);
        const kd2 = parseFloat(matches[2].kd);

        const adr0 = parseFloat(matches[0].adr);
        const adr1 = parseFloat(matches[1].adr);
        const adr2 = parseFloat(matches[2].adr);

        // L0 = média
        const L0_perf = (perf0 + perf1 + perf2) / 3;
        const L0_kd = (kd0 + kd1 + kd2) / 3;
        const L0_adr = (adr0 + adr1 + adr2) / 3;

        // T0 = média das diferenças
        const T0_perf = ((perf1 - perf0) + (perf2 - perf1)) / 2;
        const T0_kd = ((kd1 - kd0) + (kd2 - kd1)) / 2;
        const T0_adr = ((adr1 - adr0) + (adr2 - adr1)) / 2;

        const initialState = {
            performance_l: L0_perf, performance_t: T0_perf,
            kd_l: L0_kd, kd_t: T0_kd,
            adr_l: L0_adr, adr_t: T0_adr
        };

        console.log('Dados Calculados:', initialState);

        if (supabaseProtocol) {
            const { error: upErr } = await supabaseProtocol
                .from('players')
                .update(initialState)
                .eq('riot_id', agenteTag);
            
            if (upErr) console.error("❌ Erro ao atualizar Protocolo V:", upErr.message);
            else console.log("✅ Métricas Holt-Winters inicializadas no Protocolo V!");
        }
    } else {
        console.warn(`⚠️ Não foi possível inicializar: Apenas ${matches?.length || 0} partidas válidas encontradas.`);
    }
}

remedy();
