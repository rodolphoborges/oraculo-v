# Changelog (Oráculo V)

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo seguindo o padrão [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [4.0.0] - Elite Tactical AI & Dual-Base Sync - 2026-03-28

### Adicionado (Added)
- **OpenRouter Elite Engine:** Transição do motor de IA para OpenRouter (Llama 3 / Gemma 2 / Qwen), garantindo inteligência tática avançada e brutalista.
- **Local Fallback (Ollama):** Sistema de resiliência total que assume a geração de IA caso a API externa falhe.
- **Dual-Base Synchronization:** Os insights gerados no Worker (Supabase Oráculo) agora são espelhados em tempo real para o Supabase do Protocolo-V para renderização imediata.
- **Tactical Knowledge Base (`lib/tactical_knowledge.js`):** Implementação de uma base da verdade (Ground Truth) contendo:
  - Todo o Arsenal oficial (incluindo a **Outlaw**).
  - Todos os Mapas (com listagem rígida de Sites válidos para evitar alucinações de "Site C" e "Site D").
  - Todos os Agentes lore-friendly e regionais (Miks, Tejo, Veto, Waylay).
- **Quality Guard (Anti-Alucinação):** Nova rotina que expurga insights que contenham caracteres não-latinos, termos banidos ou violações geográficas (ex: mencionar C no mapa Breeze).

### Alterado (Changed)
- O baseline avaliativo (Artigo 1 - Dano Absoluto) na camada Python foi recalibrado para **130 ADR**, se alinhando com a meta oficial de impacto do Protocolo-V.
- Correção no Bug do formatador de Telegram (`worker.js`) retornando a visibilidade da seta da tendência (Holt-Winters).
- Script assíncrono agora capaz de pular (skip) pendências com mais de 48h em caso de reprocessamento em massa.

## [3.0.0] - Dynamic Strategy & Squad Analytics - 2026-03-26

### Adicionado (Added)
- Suporte a verificação de **Sinergia Operacional**: a IA agora sabe quando o atleta está jogando com aliados e critica a falta de *Trade Kills*.
- Base ampliada de templates dinâmicos de narração em vez de chaves hardcoded.
- Refatoração dos cálculos do índice KAST e FB (First Bloods) adaptados para o meta atual.

## [2.0.0] - Refatoração de Performance & Segurança - 2026-03-23

### Adicionado (Added)
-   Implementação de **Browser Singleton** no `tracker_api.js` para reuso de instâncias do Puppeteer.
-   Novo serviço `lib/ranking_service.js` para modularização da lógica de predição de rank.
-   Middleware de segurança `adminAuth` com suporte a `x-api-key`.
-   Paginação (`page`, `limit`) no endpoint de estatísticas administrativas.

### Alterado (Changed)
-   Migração massiva de I/O síncrono para **I/O Não-Bloqueante** (`fs.promises`) em `server.js`, `analyze_match.js` e `job_expansion.js`.
-   Otimização do `meta_loader.js` com consultas paralelas via `Promise.all`.
-   Refatoração do `expandAutoJob` para eliminar o padrão de consulta **N+1**, utilizando operações em lote (Bulk Select/Insert).
-   Sanitização de respostas de erro da API para prevenir vazamento de informações técnicas.

### Segurança (Security)
-   Proteção de rotas administrativas sensíveis.
-   Bloqueio de exposição de mensagens de erro internas do banco de dados.

## [1.0.0] - Lançamento Inicial - 2026-03-24

### Adicionado (Added)
-   Estrutura base do projeto Oráculo V (Express API + Worker).
-   Integração com Supabase para gerenciamento de filas e persistência de dados.
-   Motor de análise tática em Python (`analyze_valorant.py`).
-   Sistema de caching local para relatórios de análise (`/analyses`).
-   Suporte a tendências de performance baseadas em Holt-Winters para ADR, KDA e Performance Index.
-   Integração com bot do Telegram para notificações de conclusão de análise.
-   Processo automático de radar via `discover_matches.js` para monitoramento de partidas profissionais.
-   Scripts de manutenção e auditoria de banco de dados (`audit_db.js`, `global_sanitize.js`).
-   Documentação técnica estrutural (`PROJECT_CONTEXT.md`, `API.md`, `CONTRIBUTING.md`).
