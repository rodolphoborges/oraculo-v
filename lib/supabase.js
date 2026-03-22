import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env', override: true, quiet: true });

// 1. Cliente dO Oráculo-V (Onde está a fila de tarefas)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// 2. Cliente dO Protocolo-V (Onde estão os jogadores registrados)
const protocolUrl = process.env.PROTOCOL_SUPABASE_URL;
const protocolKey = process.env.PROTOCOL_SUPABASE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️  Aviso: Credenciais do Oráculo-V ausentes.');
}

if (!protocolUrl || !protocolKey) {
    console.warn('⚠️  Aviso: Credenciais do Protocolo-V ausentes. O radar automático pode falhar.');
}

// Exporta o cliente principal (Oráculo)
export const supabase = (supabaseUrl && supabaseServiceKey) 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Exporta o cliente do Protocolo (Fonte de Dados)
export const supabaseProtocol = (protocolUrl && protocolKey)
    ? createClient(protocolUrl, protocolKey)
    : null;

export const getSupabaseConfig = () => ({
  oraculoUrl: supabaseUrl,
  protocolUrl: protocolUrl,
  hasKeys: !!(supabaseServiceKey && protocolKey)
});
