# ORÁCULO V // NÚCLEO_TÁTICO v2.2

O **Oráculo V** é um **Conselheiro Tático de Elite** de arquitetura assíncrona. Ele processa metadados do [vstats.gg](https://www.vstats.gg/) e do Tracker.gg para fornecer insights profundos sob a estética "Brutalista Terminal".

## 🚨 Funcionalidades de Elite (v2.2)

- **Segurança Auditada (Anti-Injection)**: Proteção contra execução remota de código (RCE) via `spawnSync`, garantindo integridade total do host.
- **API Assíncrona & Fila**: Solicite análises via `/api/queue` e acompanhe o progresso em tempo real.
- **Painel de Monitoramento (Console)**: Acesse `/admin.html` para visualizar estatísticas globais e gerenciar jobs via Deep Links.
- **Diretriz Tática & Constituição**: O K.A.I.O. Advisor cita os **Artigos dO Protocolo V**:
  - **Art. 1: Dano Absoluto** (ADR > 130)
  - **Art. 2: Iniciativa** (First Bloods)
  - **Art. 3: Sinergia** (Trade Kills / Reset Psicológico)
- **Cálculo de Impacto vStats**: Índice de performance ponderado: **60% ADR** / 40% K/D.

## 🎞️ Léxico do Impacto

Para os iniciados dO Protocolo V, estes não são apenas números. São o pulso da sua existência operacional:

- **ADR** // *O Amasso*: O quanto você deitou o time inimigo em média por round. É o dano puro: se você não amassa, você não joga.
- **ACS** // *O Sinal*: O quanto você apareceu no jogo. Pontuação média que reflete seu combate real, abates e impacto.
- **K/D** // *A Conta*: Quantos adversários você levou antes de ir de base. O saldo entre kills e quedas.
- **FB** // *O First*: Quem dita o ritmo do round. Quem abriu o mapa e garantiu a vantagem numérica pro time logo de cara.

## 📂 Estrutura do Projeto

- `server.js`: API Express e Console Admin.
- `worker.js`: Processador autônomo da fila (Anti-Injection Ready).
- `analyze_valorant.py`: Motor de análise tática e narrativa em Python.
- `rerun_test.js`: Script de teste rápido do fluxo completo (Fila -> Worker).

## ⚙️ Configuração

1. **Instalação**: `npm install`
2. **Setup**: Renomeie `.env.example` para `.env` e preencha as chaves:
   - `SUPABASE_URL` / `SUPABASE_SERVICE_KEY`
   - `HENRIK_API_KEY` / `TELEGRAM_BOT_TOKEN`

## 🤖 Operação e Testes

### Teste Rápido (Full Stack)
Para validar o sistema completo (limpar fila, enfileirar e processar) em um comando:
```bash
node rerun_test.js
```

### Console de Operações (API)
| Rota | Método | Descrição |
| --- | --- | --- |
| `/api/queue` | POST | Envia jogador e matchId para a fila. |
| `/api/status/:matchId` | GET | Retorna o status atual e o relatório final. |
| `/api/admin/stats` | GET | Estatísticas globais de performance do Oráculo. |

---
*(C) 2026 DEEPMIND ANTIGRAVITY // PROTOCOLO_V_OPERACAO_MAXIMA*
