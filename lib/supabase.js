/**
 * lib/supabase.js
 * 
 * Centralized Supabase client management for the Oráculo V microservice.
 * Supports dual-database connectivity:
 * 1. Oráculo V (Primary): For match stats, AI insights, and technical cache.
 * 2. Protocolo V (Secondary): For the central task queue (match_analysis_queue) and player data.
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env', override: true, quiet: true });

// 1. Cliente dO Oráculo-V (Onde está a fila de tarefas)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn(`⚠️ Aviso: Credenciais do Oráculo-V ausentes. (URL: ${!!supabaseUrl}, Key: ${!!supabaseServiceKey})`);
}

// Exporta o cliente principal (Oráculo)
export const supabase = (supabaseUrl && supabaseServiceKey) 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// supabaseProtocol removido para favorecer desacoplamento via Webhooks (Soberania de Dados)
export const supabaseProtocol = null;

export const getSupabaseConfig = () => ({
  oraculoUrl: supabaseUrl,
  hasKeys: !!supabaseServiceKey
});
