import fs from 'fs';
import path from 'path';
import { supabase } from '../lib/supabase.js';

const MATCHES_DIR = './matches';

async function sanitize() {
    console.log("🧹 [ORÁCULO-V] Iniciando Sanitização Global de Elite...");
    
    if (!fs.existsSync(MATCHES_DIR)) {
        console.log("Pasta matches não encontrada. Nada a sanitizar localmente.");
        return;
    }

    const files = fs.readdirSync(MATCHES_DIR).filter(f => f.endsWith('.json'));
    const nonCompetitiveMatches = [];

    for (const file of files) {
        try {
            const data = JSON.parse(fs.readFileSync(path.join(MATCHES_DIR, file), 'utf8'));
            const queueId = data.data?.metadata?.queueId || "";
            if (queueId !== 'competitive') {
                const matchId = file.replace('.json', '');
                nonCompetitiveMatches.push(matchId);
                console.log(`❗ Detectada partida não-competitiva: ${matchId} (Modo: ${data.data?.metadata?.modeName || queueId})`);
            }
        } catch (e) {
            // console.error(`Erro ao ler ${file}: ${e.message}`);
        }
    }

    if (nonCompetitiveMatches.length === 0) {
        console.log("✅ Nenhuma partida não-competitiva encontrada no cache local.");
    } else {
        console.log(`🚀 Removendo ${nonCompetitiveMatches.length} partidas do Supabase...`);
        for (const mid of nonCompetitiveMatches) {
            const { error } = await supabase
                .from('match_analysis_queue')
                .delete()
                .eq('match_id', mid);
            
            if (error) console.error(`❌ Erro ao deletar ${mid}: ${error.message}`);
            else console.log(`🗑️ Removida: ${mid}`);

            // Opcional: remover o arquivo local também?
            // fs.unlinkSync(path.join(MATCHES_DIR, mid + '.json'));
        }
    }

    // Parte 2: O que fazer com partidas que NÃO estão em matches/ ?
    // Idealmente deveríamos consultar a API para cada uma, mas para rapidez,
    // o cache local deve cobrir a maioria das recentes.
    console.log("✨ Sanitização concluída.");
}

sanitize();
