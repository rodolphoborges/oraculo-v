CREATE TABLE IF NOT EXISTS raw_meta_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  captured_at timestamp with time zone DEFAULT now(),
  rank_tier text,
  map_name text,
  data_payload jsonb -- Aqui entra todo o conteúdo da tabela capturada
);
