
import { supabase } from './lib/supabase.js';
import dotenv from 'dotenv';
dotenv.config();

async function monitorQueue() {
    console.log('📊 Iniciando Monitoramento Final da Fila...');
    
    while (true) {
        const { data, error } = await supabase
            .from('match_analysis_queue')
            .select('status, id, player_tag');
            
        if (error) {
            console.error('❌ Erro Supabase:', error.message);
        } else {
            const pending = data.filter(d => d.status === 'pending').length;
            const processing = data.filter(d => d.status === 'processing');
            const failed = data.filter(d => d.status === 'failed').length;
            const total = data.length;
            
            console.log(`[${new Date().toLocaleTimeString()}] Pendentes: ${pending} | Processando: ${processing.length} | Falhas: ${failed} | Total: ${total}`);
            
            if (processing.length > 0) {
                console.log(`   🏃 Ativo: ${processing[0].player_tag} (ID: ${processing[0].id})`);
            }
            
            if (total === 0) {
                console.log('✅ FILA ZERADA! Todas as análises foram concluídas.');
                break;
            }
        }
        
        await new Promise(r => setTimeout(r, 60000)); // Checa a cada minuto
    }
}

monitorQueue();
