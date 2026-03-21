# ORÁCULO V // NÚCLEO_TÁTICO

O **Oráculo V** evoluiu de uma simples pipeline de captura para um **Conselheiro Tático de Elite** para jogadores do O Protocolo V. Ele processa metadados do [vstats.gg](https://www.vstats.gg/) e do Tracker.gg para fornecer insights profundos e diretrizes de impacto.

## 🚨 Funcionalidades de Elite

- **Diretriz Tática K.A.I.O.**: Análise de ADR, K/D e First Bloods traduzida em ordens táticas imediatas baseadas na Constituição dO Protocolo V.
- **Narrativa de Partida**: Transformação de logs frios em um registro cronológico de rounds com gírias brasileiras ("deitou", "foi de base", "pinou").
- **Integração Telegram**: Comando `/analisar <MATCH_ID>` integrado ao Bot Protocolov para solicitações sob demanda.
- **Radar de Partidas**: Identificação automática de jogos onde membros dO Protocolo jogaram juntos.
- **Automação de Fila**: Sistema de processamento assíncrono via Supabase e GitHub Actions para processamento 100% gratuito e escalável.

## 📂 Estrutura do Projeto

- `analyze_valorant.py`: O cérebro da análise tática (Python).
- `analyze_match.js`: Orquestrador de dados e integração Meta/Tracker.
- `worker.js`: Processador autônomo da fila de análise.
- `discover_matches.js`: Radar de descobertas de novos jogos.
- `public/`: Interface "Terminal" com dashboard brutalista.
- `scrapers/`: Scripts de coleta (Puppeteer/vStats).
- `lib/`: Lógica compartilhada (Meta Loaders, API Trackers).
- `.github/workflows/`: Automação de coleta semanal e worker horário.

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

## 🤖 Como Usar

### Manual (CLI)
```bash
node analyze_match.js "PLAYER#TAG" "MATCH_UUID"
```

### Via Telegram
Envie `/analisar <MATCH_UUID>` para o Bot Protocolov. O Oráculo entrará no radar de processamento e enviará o relatório quando pronto.

## ☁️ Automação
O projeto roda **Workers horários** e **Scrapers semanais** via GitHub Actions, garantindo que o meta consolidado esteja sempre atualizado sem custos de infraestrutura.

---
*(C) 2026 DEEPMIND ANTIGRAVITY // MODO_TERMINAL_ATIVO*
