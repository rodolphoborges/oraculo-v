-- Tabela de Templates de Comentários Dinâmicos
-- ATENÇÃO: event_types de insight estratégico (insight_consistencia_alta,
-- insight_consistencia_baixa, insight_recomendacao) NÃO devem ter entradas aqui.
-- Essas mensagens são geradas diretamente com f-strings em analyze_valorant.py
-- para garantir que os valores reais (K/D, ADR, KAST, perf_t) apareçam no texto.
-- Entradas no banco para esses tipos seriam ignoradas.
CREATE TABLE IF NOT EXISTS round_comment_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL, -- 'pos_generic', 'neg_generic', 'first_blood', 'bomb_planted', 'bomb_defused', 'eco_kill', 'low_impact_death'
  template text NOT NULL, -- Ex: "Mandou {victim_agent} de arrasta com {weapon} aos {time}."
  created_at timestamp with time zone DEFAULT now()
);

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_templates_event_type ON round_comment_templates(event_type);

-- Templates Iniciais (PT-BR)
INSERT INTO round_comment_templates (event_type, template) VALUES
-- Positivos Genéricos
('pos_generic', 'Mandou {victim_agent} de arrasta com {weapon} aos {time}.'),
('pos_generic', 'Amassou no domínio de espaço com {weapon} contra {victim_agent}.'),
('pos_generic', 'Aula de mira com {weapon} pra cima de {victim_agent}.'),
('pos_generic', 'Segurou o rush inimigo aos {time} com {weapon}.'),
('pos_generic', 'Garantiu o frag no {victim_agent} ({weapon}) no momento certo.'),
-- Negativos Genéricos
('neg_generic', 'Foi de base pra {killer_agent} ({weapon}) no contrapé aos {time}.'),
('neg_generic', 'Perdeu a troca direta contra {killer_agent} (Dano: {damage}).'),
('neg_generic', 'Pego dormindo (fora de posição) aos {time}.'),
('neg_generic', 'Tomou um sacode de {killer_agent} ({weapon}) aos {time}.'),
('neg_generic', 'Ficou isolado aos {time} e foi punido sem trade.'),
-- First Blood
('first_blood', 'Abriu o round deitando {victim_agent} aos {time}.'),
('first_blood', 'Primeiro sangue! {victim_agent} nem viu de onde veio ({weapon}).'),
('first_blood', 'Iniciativa total aos {time}, eliminando {victim_agent}.'),
-- Eventos Especiais
('bomb_planted', 'Dominou o site e garantiu o plant.'),
('bomb_planted', 'Spike no chão! Pressão total no site.'),
('bomb_defused', 'Clutch no defuse! Garantiu o round no detalhe.'),
('bomb_defused', 'Defuse heroico após limpar o site.'),
('eco_kill', 'Fez estrago no Round Eco (Gasto: ${economy}).'),
('eco_kill', 'Economia em dia: garantiu abate valioso com pouco recurso.'),
('low_impact_death', 'Morreu seco sem causar impacto ({damage} dmg).'),
('low_impact_death', 'Eliminado sem resposta tática ({damage} dmg).');
