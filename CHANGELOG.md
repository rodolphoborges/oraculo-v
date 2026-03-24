# Changelog (Oráculo V)

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo seguindo o padrão [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
