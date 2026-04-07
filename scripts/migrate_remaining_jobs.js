
import { createClient } from '@supabase/supabase-js';
import { supabase as oraculo } from '../lib/supabase.js';
import dotenv from 'dotenv';
dotenv.config();

const PROTOCOL_URL = process.env.PROTOCOL_SUPABASE_URL;
const PROTOCOL_KEY = process.env.PROTOCOL_SUPABASE_KEY;

if (!PROTOCOL_URL || !PROTOCOL_KEY) {
    console.error('❌ Falha: PROTOCOL_SUPABASE_URL ou KEY ausentes no .env');
    process.exit(1);
}

const protocolo = createClient(PROTOCOL_URL, PROTOCOL_KEY);

async function migrate() {
    console.log('📡 [MIGRATE] Iniciando transferência de jobs pendentes (Protocolo -> Oráculo)...');

    // 1. Buscar do Protocolo
    const { data: jobs, error: fetchErr } = await protocolo
        .from('match_analysis_queue')
        .select('*')
        .eq('status', 'pending');

    if (fetchErr) {
        console.error('❌ Erro ao buscar jobs do Protocolo:', fetchErr.message);
        return;
    }

    if (!jobs || jobs.length === 0) {
        console.log('✅ Nenhum job pendente no Protocolo-V.');
        return;
    }

    console.log(`📦 Encontrados ${jobs.length} jobs para migrar.`);

    for (const job of jobs) {
        const { match_id, player_id, status, metadata, agente_tag, player_tag } = job;
        
        // Normaliza campos (Oráculo usa player_tag)
        const finalTag = player_tag || agente_tag || player_id;

        console.log(`   ➡️  Migrando: ${finalTag} | Match: ${match_id}...`);

        // 2. Inserir no Oráculo
        const { error: insErr } = await oraculo
            .from('match_analysis_queue')
            .insert([{
                match_id,
                player_tag: finalTag,
                status: 'pending',
                metadata: metadata || {}
            }]);

        if (insErr) {
            console.warn(`   ⚠️ Erro ao inserir ${match_id}: ${insErr.message}`);
        } else {
            // 3. Marcar como completado no Protocolo (ou deletar) para evitar duplicatas
            await protocolo
                .from('match_analysis_queue')
                .update({ status: 'completed', error_message: 'Migrado para Oráculo-V' })
                .eq('id', job.id);
            console.log(`   ✅ Sucesso.`);
        }
    }

    console.log('\n🏁 [MIGRATE] Migração finalizada.');
}

migrate();
