# Changelog (Oráculo V)

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo seguindo o padrão [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
