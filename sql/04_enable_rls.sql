-- ============================================================
-- Oraculo-V: Habilitar Row-Level Security em TODAS as tabelas
-- ============================================================
-- IMPORTANTE: O backend usa SUPABASE_SERVICE_KEY (Service Role),
-- que BYPASSA RLS automaticamente. Nenhuma mudanca no backend.
-- Este script apenas bloqueia acesso via anon key (publica).
-- ============================================================

-- 1. Habilitar RLS
ALTER TABLE match_analysis_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE round_comment_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tactical_roles_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_tactical_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_meta_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- 2. Policies para acesso publico (anon) — SOMENTE leitura onde necessario
-- Blog posts: leitura publica (conteudo publico)
CREATE POLICY "blog_posts_public_read" ON blog_posts
  FOR SELECT TO anon USING (true);

-- Tactical config: leitura publica (dados estaticos de referencia)
CREATE POLICY "tactical_roles_public_read" ON tactical_roles_config
  FOR SELECT TO anon USING (true);

CREATE POLICY "global_tactical_public_read" ON global_tactical_config
  FOR SELECT TO anon USING (true);

CREATE POLICY "round_templates_public_read" ON round_comment_templates
  FOR SELECT TO anon USING (true);

-- TODAS as outras tabelas (match_analysis_queue, match_stats, ai_insights,
-- raw_meta_snapshots) ficam SEM policy para anon = acesso BLOQUEADO via anon key.
-- Apenas o backend (service_role) consegue ler/escrever.
