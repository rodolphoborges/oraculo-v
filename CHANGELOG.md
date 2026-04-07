# Changelog (Oraculo V)

Todas as mudancas notaveis neste projeto serao documentadas neste arquivo seguindo o padrao [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [5.1.0] - Tribunal Engine & Natural JS - 2026-04

### Adicionado (Added)
- **Tribunal Engine (Motor LLM Adversarial):** Sistema de analise com 3 personas — Perspectiva Aliada, Perspectiva Rival e Mentor K.A.I.O. — para insights de coaching com multiplas perspectivas.
- **Endpoint `/api/chat`:** Interacao direta com K.A.I.O. via LLM local (Ollama), usando base tatica completa como contexto.
- **Endpoint `/api/health`:** Health check detalhado com status do banco e contagem de jobs pendentes.
- **Endpoint `/api/ping`:** Health check basico de disponibilidade.
- **Groq como provider primario:** Integrado Groq (`llama-3.3-70b-versatile`) como primeiro provider LLM, mais rapido que OpenRouter.
- **Modelos por persona:** Cada persona do Tribunal pode usar modelos diferentes configurados em `PERSONA_MODELS`.
- **Timeout global de 5 minutos:** Safety net para jobs que travarem no processamento.
- **Valorant API integration (`lib/valorant_api.js`):** Consulta habilidades de agentes para contexto tatico das personas.

### Alterado (Changed)
- **Worker auto-start:** O worker agora inicia automaticamente com o `server.js` via `startWorker()`. Nao e mais necessario rodar em terminal separado.
- **Pipeline de IA refatorada:** Tribunal Engine e o caminho primario. Se falhar ou nao houver JSON da partida, usa `generateInsights()` (OpenRouter) como fallback.
- **Persistencia local em `match_stats`:** Stats sao persistidos no banco proprio do Oraculo (anteriormente usava dual-write para ambos os bancos).

## [5.0.0] - Migracao Python -> JavaScript Nativo - 2026-04

### Adicionado (Added)
- **Motor JS Nativo (`lib/analyze_valorant.js`):** Todo o calculo de Performance Index, Holt-Winters e classificacao por role migrado de Python para JavaScript puro.
- **Pesos v4.2:** Novos pesos por classe (Duelista 45/55/0, Iniciador 20/30/50, Controlador 15/20/65, Sentinela 15/20/65) — mais extremos e especializados que v4.1.

### Removido (Removed)
- **Motor Python (`analyze_valorant.py`):** Removido do pipeline ativo. Arquivo mantido apenas em `scripts/maintenance/` para referencia.
- **ImpactAnalyzer.js:** Ja removido na v4.0, confirmado ausente.
- **Dual-Base Sync direto:** Comunicacao com Protocolo-V agora e exclusivamente via Webhook callback. Acesso direto ao banco do Protocolo so ocorre como fallback de emergencia.

### Alterado (Changed)
- **Versao do engine:** Identificador mudou para `v5.1.0-NATURAL-JS` no header do worker.
- **supabaseProtocol removido:** `lib/supabase.js` exporta `supabaseProtocol = null` por padrao, favorecendo desacoplamento.

## [4.1.0] - Admin Console, Queue Lifecycle & Role-Aware Index - 2026-03-30

### Adicionado (Added)
- **Performance Index Contextual (Role-Aware):** Calculo do indice agora pondera K/D, ADR e KAST com pesos especificos por classe de agente (v4.1: Duelista 40/40/20, Iniciador 35/35/30, Controlador 30/30/40, Sentinela 30/30/40).
- **Tres Ranks Tecnicos:** Alpha (>=115), Omega (95-114), Deposito de Torreta (<95) com tone_instruction para feedback contextual da LLM.
- **Painel Admin (Frontend):** Duas abas — FILA (pending/processing/failed) e HISTORICO. Frontend implementado em `public/admin.html` e `public/admin.js`.
- **Limpeza Automatica de Fila:** Jobs falhados com mais de 7 dias sao removidos automaticamente.
- **Enciclopedia v4.0:** Pagina `enciclopedia.html` reescrita com regras vigentes.

### Alterado (Changed)
- **Ciclo de Vida da Fila:** Jobs completos agora sao **DELETADOS** da `match_analysis_queue` em vez de marcados como `completed`.
- **Fonte Unica de Verdade:** Motor Python era o unico avaliador nesta versao. `ImpactAnalyzer.js` foi removido.
- **K/D Alvo dinamico:** Obtido em tempo real via vStats.gg filtrado por agente/mapa/rank.

> **Nota**: Os endpoints admin documentados no CHANGELOG v4.1 (DELETE, reprocess, history) foram planejados mas **nao chegaram a ser implementados no backend**. O frontend os referencia mas nao tem backend correspondente.

## [4.0.0] - Elite Tactical AI & Dual-Base Sync - 2026-03-28

### Adicionado (Added)
- **OpenRouter Elite Engine:** Transicao do motor de IA para OpenRouter (Llama 3 / Gemma 2 / Qwen).
- **Local Fallback (Ollama):** Sistema de resiliencia total que assume a geracao de IA caso a API externa falhe.
- **Dual-Base Synchronization:** Insights espelhados em tempo real para o Supabase do Protocolo-V.
- **Tactical Knowledge Base (`lib/tactical_knowledge.js`):** Base da verdade com arsenal, mapas e agentes.
- **Quality Guard (Anti-Alucinacao):** Rotina que expurga insights com caracteres nao-latinos, termos banidos ou violacoes geograficas.

### Alterado (Changed)
- Baseline avaliativo recalibrado para **130 ADR**.
- Correcao no formatador de Telegram (`worker.js`).

## [3.0.0] - Dynamic Strategy & Squad Analytics - 2026-03-26

### Adicionado (Added)
- Suporte a verificacao de **Sinergia Operacional**.
- Base ampliada de templates dinamicos de narracao.
- Refatoracao dos calculos do indice KAST e FB.

## [2.0.0] - Refatoracao de Performance & Seguranca - 2026-03-23

### Adicionado (Added)
- **Browser Singleton** no `tracker_api.js` para reuso de instancias do Puppeteer.
- Middleware de seguranca `adminAuth` com suporte a `x-api-key`.
- Paginacao (`page`, `limit`) no endpoint de estatisticas.

### Alterado (Changed)
- Migracao massiva de I/O sincrono para **I/O Nao-Bloqueante** (`fs.promises`).
- Otimizacao do `meta_loader.js` com consultas paralelas via `Promise.all`.

## [1.0.0] - Lancamento Inicial - 2026-03-24

### Adicionado (Added)
- Estrutura base do projeto Oraculo V (Express API + Worker).
- Integracao com Supabase para gerenciamento de filas.
- Motor de analise tatica em Python (`analyze_valorant.py`).
- Sistema de caching local para relatorios de analise (`/analyses`).
- Tendencias de performance baseadas em Holt-Winters.
- Integracao com bot do Telegram para notificacoes.
- Documentacao tecnica estrutural.
