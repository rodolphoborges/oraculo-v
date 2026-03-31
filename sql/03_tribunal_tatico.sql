-- ============================================================
-- 03_tribunal_tatico.sql
-- Base de Conhecimento Evolutiva do Árbitro (Tribunal Tático)
-- ============================================================

CREATE TABLE IF NOT EXISTS arbiter_knowledge (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Contexto do padrão
    pattern_type TEXT NOT NULL,          -- 'agent_matchup', 'map_tendency', 'economy_pattern', 'role_interaction', 'team_comp'
    context_key TEXT NOT NULL,           -- ex: 'jett_vs_chamber_ascent', 'eco_after_loss_3'

    -- O conhecimento em si
    observation TEXT NOT NULL,           -- Descrição do padrão observado
    confidence FLOAT DEFAULT 0.5        -- 0.0 a 1.0 (bayesiano: sobe a cada confirmação)
        CHECK (confidence >= 0.0 AND confidence <= 1.0),
    times_seen INT DEFAULT 1,           -- Quantas vezes o padrão apareceu
    times_confirmed INT DEFAULT 0,      -- Quantas vezes o padrão se confirmou

    -- Rastreio
    last_match_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para busca rápida pelo Árbitro
CREATE INDEX IF NOT EXISTS idx_arbiter_pattern_type ON arbiter_knowledge(pattern_type);
CREATE INDEX IF NOT EXISTS idx_arbiter_context_key ON arbiter_knowledge(context_key);
CREATE INDEX IF NOT EXISTS idx_arbiter_confidence ON arbiter_knowledge(confidence DESC);

-- Índice composto para busca por tipo + chave (uso principal)
CREATE UNIQUE INDEX IF NOT EXISTS idx_arbiter_type_key ON arbiter_knowledge(pattern_type, context_key);

-- Tabela de histórico de vereditos (audit trail)
CREATE TABLE IF NOT EXISTS tribunal_verdicts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    match_id UUID NOT NULL,
    player_id TEXT NOT NULL,

    -- As 3 análises
    advocate_insight JSONB NOT NULL,     -- Análise da Persona 1 (Advogado)
    prosecutor_insight JSONB NOT NULL,   -- Análise da Persona 2 (Promotor)
    arbiter_verdict JSONB NOT NULL,      -- Veredito final da Persona 3

    -- Metadados do julgamento
    winning_persona TEXT NOT NULL,        -- 'advocate', 'prosecutor', 'empate'
    advocate_model TEXT,
    prosecutor_model TEXT,
    arbiter_model TEXT,

    -- Padrões aprendidos neste veredito
    patterns_learned INT DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tribunal_match ON tribunal_verdicts(match_id);
CREATE INDEX IF NOT EXISTS idx_tribunal_player ON tribunal_verdicts(player_id);
