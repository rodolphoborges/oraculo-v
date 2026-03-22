import { supabase } from './lib/supabase.js';
import fs from 'fs';
import path from 'path';

async function clearQueue() {
    console.log("🧹 [SISTEMA] Iniciando limpeza total da fila dO Oráculo...");
    
    // Deleta todos os registros da tabela de fila
    const { data, error, count } = await supabase
        .from('match_analysis_queue')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Deleta tudo que não tem esse ID impossível

    if (error) {
        console.error("❌ Erro ao limpar fila:", error.message);
    } else {
        console.log("✅ [ORÁCULO] Fila Supabase zerada com sucesso.");
    }

    // Limpa a pasta local de matches
    const matchesDir = './matches';
    if (fs.existsSync(matchesDir)) {
        console.log("🧹 [SISTEMA] Limpando cache local de partidas...");
        fs.readdirSync(matchesDir).forEach(file => {
            fs.unlinkSync(path.join(matchesDir, file));
        });
        console.log("✅ [ORÁCULO] Cache local limpo.");
    }
}

clearQueue();
