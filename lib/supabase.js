import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env', override: true, quiet: true });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️  Aviso: Credenciais do Supabase ausentes no arquivo .env.');
  console.warn('O sistema funcionará com baselines padrão até que o Supabase seja configurado.');
}

export const supabase = (supabaseUrl && supabaseServiceKey) 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

export const getSupabaseConfig = () => ({
  url: supabaseUrl,
  hasKey: !!supabaseServiceKey
});
