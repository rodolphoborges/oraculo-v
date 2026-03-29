-- =========================================================================
-- Migration 02: Desacoplamento Protocolo-V & Oráculo-V
-- Data: 2026-03-29
-- Descrição: Remove as tabelas de controle local (matches/queue) e ajusta 
--             match_stats para o novo modelo de soberania do Protocolo-V.
-- =========================================================================

BEGIN;

-- 1. Remoção de Constraints de Integridade Referencial
-- Removemos a dependência da tabela local 'matches', pois o Protocolo-V agora é o dono.
ALTER TABLE IF EXISTS public.match_stats 
    DROP CONSTRAINT IF EXISTS match_stats_match_id_fkey;

ALTER TABLE IF EXISTS public.ai_insights 
    DROP CONSTRAINT IF EXISTS ai_insights_match_id_fkey;

-- 2. Remoção das Tabelas de Controle
-- A fila (match_analysis_queue) e o histórico de matches (matches) passam a ser 
-- responsabilidade técnica do ecossistema central (Protocolo-V).
DROP TABLE IF EXISTS public.matches CASCADE;
DROP TABLE IF EXISTS public.match_analysis_queue CASCADE;

-- 3. Atualização da Tabela match_stats (Estatísticas Técnicas)
-- Garantimos que player_id aceite Riot ID (TEXT) e match_id seja UUID universal.
ALTER TABLE public.match_stats 
    ALTER COLUMN player_id TYPE TEXT,
    ALTER COLUMN player_id SET NOT NULL,
    ALTER COLUMN match_id TYPE UUID;

-- 4. Adição do Campo impact_score
-- Armazenará o cálculo de performance tática bruta (IK) antes do processamento pela LLM.
ALTER TABLE public.match_stats 
    ADD COLUMN IF NOT EXISTS impact_score NUMERIC;

-- Comentários de Arquitetura para o DBA
COMMENT ON TABLE public.match_stats IS 'Estatísticas técnicas processadas pelo Oráculo-V. O match_id é originário do Protocolo-V.';
COMMENT ON COLUMN public.match_stats.impact_score IS 'Score de impacto tático consolidado (ADR + K/D ponderado) para auxílio da IA.';

COMMIT;
