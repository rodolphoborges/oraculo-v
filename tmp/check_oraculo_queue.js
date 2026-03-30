import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const oraculo = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkOraculo() {
    console.log('Verificando fila no Oráculo-V (Local)...');
    const { data, error } = await oraculo.from('match_analysis_queue').select('*').limit(10);
    
    if (error) {
        console.error('Erro ao buscar fila no Oráculo-V:', error.message);
    } else {
        console.log(`Encontrados ${data.length} registros no Oráculo-V.`);
        console.table(data);
    }
}

checkOraculo();
