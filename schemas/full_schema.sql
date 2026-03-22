-- Tabela de Jogadores Registrados
CREATE TABLE IF NOT EXISTS players (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  riot_id text UNIQUE NOT NULL, -- Nick#Tag
  telegram_id text,
  created_at timestamp with time zone DEFAULT now()
);

-- Fila de Processamento de Partidas
CREATE TABLE IF NOT EXISTS match_analysis_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id text NOT NULL,
  agente_tag text NOT NULL, -- Pode ser 'AUTO' ou Nick#Tag
  status text DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  created_at timestamp with time zone DEFAULT now(),
  processed_at timestamp with time zone,
  chat_id text, -- ID do chat do Telegram para notificação
  error_msg text,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Snapshots de Meta (vStats)
CREATE TABLE IF NOT EXISTS raw_meta_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  captured_at timestamp with time zone DEFAULT now(),
  rank_tier text,
  map_name text,
  data_payload jsonb
);

-- Posts do Blog via Scraper
CREATE TABLE IF NOT EXISTS blog_posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text,
  url text UNIQUE,
  description text,
  content text,
  published_at timestamp with time zone,
  captured_at timestamp with time zone DEFAULT now()
);
