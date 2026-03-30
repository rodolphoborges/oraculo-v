import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const matchId = 'b321fc60-a15f-441d-8ba3-7ec0dc11fe0b';
const players = [
    'm4sna#chama',
    'ALEGRIA#021',
    'Vduart#MEE',
    'DefeitoDeFabrica#ZzZ'
];

async function resetAndRequeue() {
    console.log(`Resetando análises para a partida ${matchId}...`);

    // 1. Limpar banco (Oráculo-V)
    const oraculo = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    const { error: err1 } = await oraculo.from('ai_insights').delete().eq('match_id', matchId);
    if (err1) console.error('Erro ao limpar ai_insights:', err1);
    else console.log('OK: Banco limpo.');

    // 2. Limpar arquivos locais
    const analysesDir = './analyses';
    const files = fs.readdirSync(analysesDir).filter(f => f.startsWith(`match_${matchId}`));
    files.forEach(f => {
        fs.unlinkSync(path.join(analysesDir, f));
        console.log(`Deletado: ${f}`);
    });

    // 3. Re-enfileirar via API Interna (para garantir que use as novas regras)
    for (const player_id of players) {
        console.log(`Enviando ${player_id} para a fila...`);
        try {
            const resp = await fetch('http://localhost:3000/api/queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player_id, match_id: matchId })
            });
            if (resp.ok) console.log(`✅ [OK] ${player_id}`);
            else console.error(`❌ [ERRO] ${player_id}: ${resp.status}`);
        } catch (e) {
            console.error(`❌ [FALHA] ${player_id}: ${e.message}`);
        }
    }
}

resetAndRequeue();
