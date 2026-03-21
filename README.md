# ORÁCULO V // NÚCLEO_TÁTICO v2.0

O **Oráculo V** evoluiu de uma simples pipeline de captura para um **Conselheiro Tático de Elite** de arquitetura assíncrona. Ele processa metadados do [vstats.gg](https://www.vstats.gg/) e do Tracker.gg para fornecer insights profundos sob a estética "Brutalista Terminal".

## 🚨 Funcionalidades de Elite (v2.0)

- **API Assíncrona & Fila**: Solicite análises via `/api/queue` e acompanhe o progresso em tempo real sem travamentos.
- **Painel de Monitoramento (Console)**: Acesse `/admin.html` para visualizar estatísticas globais, jobs pendentes e abrir relatórios diretamente via Deep Links.
- **Imersão Terminal (Organic CMD)**: Ao abrir links diretos, o sistema oculta a interface de entrada e simula a execução de um comando `analyze` no terminal.
- **Diretriz Tática K.A.I.O. (BR)**: Análise de ADR, K/D e First Bloods localizada com gírias reais e **Alinhamento Constitucional** (Artigos 1, 2 e 3).
- **Cálculo de Performance (vStats)**: O índice de impacto prioriza o **ADR (60%)** em relação ao K/D, seguindo a filosofia de que "Dano é Absoluto".
- **Integração Telegram**: Comando `/analisar <MATCH_ID>` integrado ao Bot Protocolov com notificações automáticas.

## 📂 Estrutura do Projeto

- `server.js`: Servidor Express com endpoints de API e Console Admin.
- `worker.js`: Processador autônomo que consome a fila do Supabase.
- `analyze_valorant.py`: O "cérebro" de análise tática (Python 3).
- `analyze_match.js`: Orquestrador de dados e integrações Meta/Tracker.
- `public/admin.html`: Painel de monitoramento e controle.
- `public/app.js`: Interface principal com modo "Organic CMD".

## ⚙️ Configuração

1. **Instalação**:
   ```bash
   npm install
   ```

2. **Variáveis de Ambiente (.env)**:
   ```env
   SUPABASE_URL=seu_url
   SUPABASE_SERVICE_KEY=sua_chave_service_role
   HENRIK_API_KEY=sua_chave_henrik
   TELEGRAM_BOT_TOKEN=token_do_bot
   ```

3. **Banco de Dados**:
   Certifique-se de rodar os scripts SQL em `schemas/` e `setup_queue_table.sql` no Supabase SQL Editor.

## 🤖 Console de Operações (API)

| Rota | Método | Descrição |
| --- | --- | --- |
| `/api/queue` | POST | Envia jogador e matchId para a fila de processamento. |
| `/api/status/:matchId` | GET | Retorna o status atual (pending, processing, completed). |
| `/api/admin/stats` | GET | Retorna estatísticas de uso para o painel de controle. |

## ☁️ Automação
O projeto roda **Workers horários** e **Scrapers semanais** via GitHub Actions, garantindo que o meta consolidado esteja sempre atualizado sem custos de infraestrutura.

---
*(C) 2026 DEEPMIND ANTIGRAVITY // PROTOCOLO_V_OPERACAO_MAXIMA*
