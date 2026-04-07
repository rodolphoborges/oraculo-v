# Oraculo V | Documentacao da API (v5.1)

Esta documentacao descreve os endpoints implementados no microsservico Oraculo V.

## Padroes de Comunicacao

-   **Protocolo**: HTTP/HTTPS
-   **Formato**: JSON (Content-Type: `application/json`)
-   **Padrao**: RESTful
-   **Autenticacao**: Header `x-api-key: <token>` para rotas protegidas. Requests de `localhost` sao aceitos sem chave.

## Endpoints Implementados

### 1. Enfileirar Briefing de Partida

Solicita que o Oraculo processe uma analise tatica de forma assincrona.

**Endpoint**: `POST /api/queue`
**Auth**: `x-api-key`

**Request Payload**:
```json
{
  "match_id": "5660ca26-8e21-40bc-bfd6-8bd2a85c1409",
  "player_id": "Mahoraga#Chess",
  "map_name": "Ascent",
  "agent_name": "Jett",
  "metadata": {
    "holt_state": { "performance_l": 95.0, "performance_t": 2.1 }
  }
}
```

**Response (202 Accepted)**:
```json
{
  "message": "Job enfileirado no Oraculo-V.",
  "matchId": "5660ca26-8e21-40bc-bfd6-8bd2a85c1409",
  "player": "Mahoraga#Chess"
}
```

---

### 2. Analise Sincrona

Processa a analise e retorna o resultado **imediatamente** na resposta HTTP. Recomendado para debug ou casos criticos.

**Endpoint**: `POST /api/analyze`
**Auth**: `x-api-key`

**Request Payload**: Mesmo formato do `/api/queue`.

**Response (200 OK)**:
```json
{
  "status": "completed",
  "matchId": "5660ca26-8e21-40bc-bfd6-8bd2a85c1409",
  "player": "Mahoraga#Chess",
  "insight": {
    "diagnostico_principal": "Analise completa do comportamento tatico...",
    "classification": "Alpha",
    "is_fallback": false
  }
}
```

---

### 3. Consultar Status/Resultado

Retorna o estado atual de um processamento ou o resultado completo se finalizado. Verifica primeiro o cache local (arquivo JSON) e depois o banco de dados.

**Endpoint**: `GET /api/status/:matchId?player={playerTag}`
**Auth**: Publico

**Response (200 OK - Completed)**:
```json
{
  "status": "completed",
  "result": {
    "agent": "Jett",
    "map": "Ascent",
    "performance_index": 118.5,
    "performance_status": "ELITE DO PROTOCOLO",
    "technical_rank": "Alpha",
    "kd": 1.5,
    "adr": 165.5,
    "conselho_kaio": { "..." }
  }
}
```

**Response (404 - Pendente/Nao encontrado)**:
```json
{
  "status": "pending"
}
```

---

### 4. Chat com K.A.I.O.

Interacao direta com o mentor tatico K.A.I.O. via LLM local (Ollama). Utiliza a base tatica completa como contexto do sistema.

**Endpoint**: `POST /api/chat`
**Auth**: `x-api-key`

**Request Payload**:
```json
{
  "messages": [
    { "role": "user", "content": "Como melhorar meu entry frag como Jett?" }
  ]
}
```

**Response (200 OK)**:
```json
{
  "response": "Para melhorar seu entry frag...",
  "model": "Gemma3-Oraculo"
}
```

---

### 5. Health Check

**Endpoint**: `GET /api/ping`
**Auth**: Publico

**Response**:
```json
{
  "status": "online",
  "service": "Oraculo-V Bridge",
  "timestamp": "2026-04-07T00:00:00.000Z"
}
```

---

### 6. Status Detalhado

Retorna o estado da conexao com o banco e a contagem de jobs pendentes.

**Endpoint**: `GET /api/health`
**Auth**: Publico

**Response**:
```json
{
  "status": "ok",
  "service": "Oraculo-V",
  "db": { "connected": true },
  "queue": { "pending": 3 }
}
```

---

## Webhook de Callback (Outbound)

Apos concluir uma analise, o Worker envia automaticamente o resultado para o Protocolo-V:

**Destino**: `POST {PROTOCOL_API_URL}/api/insights/callback`
**Auth**: `x-api-key: {ADMIN_API_KEY}`

**Payload enviado**:
```json
{
  "match_id": "uuid",
  "player_id": "Nick#Tag",
  "insight_resumo": { "diagnostico_principal": "...", "classification": "Alpha" },
  "analysis_report": { "agent": "Jett", "kd": 1.5, "adr": 165, "..." },
  "model_used": "llama-3.3-70b-versatile",
  "classification": "Alpha",
  "impact_score": 118.5,
  "engine_version": "5.1.0",
  "holt_state": { "performance_l": 110, "performance_t": 3.2 }
}
```

Se o webhook falhar, o worker tenta persistencia direta no banco do Protocolo-V (via `PROTOCOL_SUPABASE_URL`/`PROTOCOL_SUPABASE_KEY`) como fallback.

---

## Codigos de Erro

-   `400 Bad Request`: Parametros invalidos ou formatos (ex: Match ID nao e UUID valido).
-   `401 Unauthorized`: API Key administrativa ausente ou invalida.
-   `404 Not Found`: Analise nao localizada.
-   `500 Internal Server Error`: Erro generico de servidor.

---

## Endpoints NAO Implementados (Removidos)

Os seguintes endpoints constavam na documentacao anterior (v4.1) mas **nao possuem implementacao no backend**:

- ~~`GET /api/v1/players/{id}`~~ — Perfil de jogador (nunca implementado no Oraculo)
- ~~`GET /api/admin/stats`~~ — Estatisticas admin
- ~~`GET /api/admin/history`~~ — Historico de analises
- ~~`DELETE /api/admin/analysis`~~ — Apagar analise individual
- ~~`DELETE /api/admin/analysis/all`~~ — Apagar todas as analises
- ~~`POST /api/admin/reprocess`~~ — Reprocessar analise

> **Nota**: O frontend admin (`public/admin.html`) referencia estes endpoints mas eles nao funcionam. Implementacao futura pendente.
