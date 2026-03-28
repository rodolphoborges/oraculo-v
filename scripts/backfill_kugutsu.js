import { supabase } from '../lib/supabase.js';

const MATCH_IDS = [
    "986527c3-2aab-4287-b053-47737abf302a",
    "45f106c4-4968-4a28-b5d1-8a66030e8b00",
    "4b01b8a9-ce0c-426f-81e2-aaefe4089b09",
    "7cba9bc3-a601-4c03-b93e-d7713ce803f7",
    "f495da3e-c7c3-4778-93b6-2a680992e5f2"
];

async function backfill() {
    console.log("📥 [BACKFILL] Enfileirando 5 partidas para kugutsuhasu#2145...");
    
    const jobs = MATCH_IDS.map(mid => ({
        match_id: mid,
        agente_tag: 'kugutsuhasu#2145',
        status: 'pending',
        metadata: { source: 'backfill_maintenance' }
    }));

    const { error } = await supabase
        .from('match_analysis_queue')
        .insert(jobs);

    if (error) {
        console.error("❌ Erro ao enfileirar partidas:", error.message);
    } else {
        console.log("✅ 5 partidas enfileiradas com sucesso.");
    }
}

backfill();
