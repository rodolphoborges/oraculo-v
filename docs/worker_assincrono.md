# Motor Tatico Assincrono (`worker.js`) — v5.1

Este documento detalha o funcionamento interno do worker responsavel pela gestao da fila e processamento assincrono do Oraculo-V.

## 1. Topologia de Monitoramento (Loop Infinito)

O script `worker.js` opera em um laco ininterrupto (`while(true)`), consumindo a tabela `match_analysis_queue` do banco Supabase do Oraculo.

- **Intervalo de polling**: 5 segundos quando a fila esta vazia.
- **Auto-start**: O worker inicia automaticamente com o `server.js` via `startWorker()`. Tambem pode ser executado isoladamente via `node worker.js`.

## 2. Ciclo de Vida do Job (v5.1)

1. **Pendente (`pending`)**: Job enfileirado em `match_analysis_queue`.
2. **Processando (`processing`)**: Worker captura o job e atualiza o status.
3. **Concluido**: Job e **DELETADO** da fila. Resultado persiste em `match_stats` e e enviado via webhook.
4. **Falhado (`failed`)**: Job permanece na fila com status `failed` e mensagem de erro (`error_message`).

> **Importante**: Jobs concluidos NAO sao marcados como "completed" — sao removidos da fila. A fila contem apenas jobs ativos.

## 3. Pipeline de Processamento (`processBriefing`)

Cada job passa por 5 etapas sequenciais com timeout global de 5 minutos:

```
[1/5] Carregando estado Holt-Winters (match_stats, ultimas 3 partidas)
[2/5] Executando Motor Tatico (analyze_match.js -> lib/analyze_valorant.js)
[3/5] Gerando Insights de IA (Tribunal Engine ou fallback OpenRouter)
[4/5] Persistindo dados no Oraculo-V (upsert em match_stats)
[5/5] Executando Callback para o Protocolo-V (webhook REST)
```

### Etapa 1: Estado Holt-Winters
Busca as ultimas 3 partidas do jogador em `match_stats` para obter o nivel (L) e tendencia (T) atuais. Se nao houver historico, inicializa com zeros.

### Etapa 2: Motor Tatico (JS Nativo)
Executa `runAnalysis()` que:
- Baixa dados da partida via Puppeteer/tracker.gg
- Consulta meta (vStats.gg) para K/D alvo
- Calcula Performance Index, Holt-Winters, classificacao de rank

### Etapa 3: Insights de IA
- **Caminho primario**: Tribunal Engine (`runTribunal`) — requer JSON da partida em `matches/{match_id}.json`
- **Fallback**: `generateInsights()` via OpenRouter — usado se o JSON nao existir ou o Tribunal falhar
- **Fallback final**: Insight baseado nos dados do motor JS (sem LLM)

### Etapa 4: Persistencia Local
Upsert dos stats em `match_stats` do banco do Oraculo:
- `match_id`, `player_id`, `agent`, `role`
- `kills`, `deaths`, `acs`, `adr`, `kast`
- `first_bloods`, `clutches`, `is_win`
- `impact_score` (Performance Index), `impact_rank` (Alpha/Omega/Deposito)

### Etapa 5: Callback Webhook
Envia payload completo para `{PROTOCOL_API_URL}/api/insights/callback`:
- Insight do Tribunal/OpenRouter
- Report tecnico completo
- Estado Holt-Winters atualizado
- Versao do engine

**Fallback de persistencia**: Se o webhook falhar e `PROTOCOL_SUPABASE_URL` estiver configurado, tenta upsert direto na tabela `ai_insights` do Protocolo-V.

## 4. Integracao de Dados

### Banco de Dados (Soberano)
O worker opera exclusivamente sobre o banco do Oraculo-V:
- **Leitura**: `match_analysis_queue` (fila), `match_stats` (historico)
- **Escrita**: `match_stats` (upsert apos analise)
- **Delete**: `match_analysis_queue` (remocao apos sucesso)

### Comunicacao com Protocolo-V
Exclusivamente via webhook REST. O acesso direto ao banco do Protocolo so ocorre como fallback de emergencia (se `PROTOCOL_SUPABASE_URL` estiver configurado).

## 5. Versao do Engine

O worker identifica-se como `v5.1.0-NATURAL-JS`, indicando:
- Motor matematico 100% JavaScript (sem Python)
- Tribunal Engine com LLM adversarial
- Pipeline naturalizada (sem spawn de processos externos)
