-- =========================================================================
-- Arquitetura OpenRouter + Supabase: LLM Insights Engine
-- Execute este arquivo no SQL Editor do seu projeto Supabase (Protocolo V)
-- =========================================================================

-- 1. Tabela Opcional para Grupos (Analise de Sinergia)
CREATE TABLE IF NOT EXISTS public.squads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    members TEXT[] NOT NULL, -- Array de Riot IDs (ex: {Kugutsuhasu#2145, OUSADIA#013})
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela Opcional: Dados Brutos da Partida
CREATE TABLE IF NOT EXISTS public.matches (
    match_id UUID PRIMARY KEY,
    map_name TEXT,
    queue_id TEXT,
    rounds INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabela: Estatísticas Técnicas da Partida por Jogador
-- Pode ser alimentada a partir dos dados do Oráculo V
CREATE TABLE IF NOT EXISTS public.match_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    match_id UUID REFERENCES public.matches(match_id) ON DELETE CASCADE,
    player_id TEXT NOT NULL, -- Riot ID
    agent TEXT,
    role TEXT,
    kills INT,
    deaths INT,
    acs NUMERIC,
    adr NUMERIC,
    kast NUMERIC, -- Opcional, taxa de Sobrevivencia/KAST
    first_bloods INT,
    clutches INT,
    is_win BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(match_id, player_id)
);

-- 4. Tabela de Memória da Inteligência Artificial
-- Histórico para não repetir os mesmos conselhos
CREATE TABLE IF NOT EXISTS public.ai_insights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    match_id UUID REFERENCES public.matches(match_id) ON DELETE CASCADE,
    player_id TEXT NOT NULL,
    insight_resumo JSONB NOT NULL, -- Resposta formatada da LLM
    model_used TEXT, -- Salva qual fallback model gerou (Llama/Gemma)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. ENGINE DE TENDÊNCIAS HISTÓRICAS (Moving Averages)
-- VIEW que consulta o "last 10 matches" para alimentar o Prompt da LLM
CREATE OR REPLACE VIEW public.vw_player_trends AS
WITH ranked_matches AS (
    SELECT 
        player_id,
        acs,
        adr,
        (kills::numeric / NULLIF(deaths, 0)) AS kd_ratio,
        kast,
        is_win,
        ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY created_at DESC) AS m_rank
    FROM public.match_stats
)
SELECT 
    player_id,
    COUNT(*) AS matches_analyzed,
    ROUND(AVG(acs), 1) AS avg_acs,
    ROUND(AVG(adr), 1) AS avg_adr,
    ROUND(AVG(kd_ratio), 2) AS avg_kd,
    ROUND(AVG(kast), 1) AS avg_kast,
    SUM(CASE WHEN is_win THEN 1 ELSE 0 END) AS wins,
    SUM(CASE WHEN NOT is_win THEN 1 ELSE 0 END) AS losses
FROM ranked_matches
WHERE m_rank <= 10
GROUP BY player_id;
