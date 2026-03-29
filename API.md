# Oráculo V | Documentação da API

Esta documentação descreve os padrões de comunicação e endpoints do microsserviço Oráculo V.

## Padrões de Comunicação

-   **Protocolo**: HTTPS
-   **Formato**: JSON (Content-Type: `application/json`)
-   **Padrão**: RESTful
-   **Autenticação**:
    -   **Público**: Sem autenticação necessária.
    -   **Admin**: Exige header `x-api-key: <token>` para rotas de estatísticas e gestão.

## Endpoints Principais

### 1. Enviar Briefing de Partida (Push)
Solicita que o Oráculo processe uma análise tática a partir de dados estruturados vindos do Protocolo-V.

**Endpoint**: `POST /api/queue`

**Request Payload**:
```json
{
  "match_id": "5660ca26-8e21-40bc-bfd6-8bd2a85c1409",
  "player_id": "Mahoraga#Chess",
  "map_name": "Ascent",
  "agent_name": "Jett",
  "squad_stats": [...], 
  "raw_data": { ... } 
}
```

**Response (202 Accepted)**:
```json
{
  "message": "Briefing aceito e processamento iniciado.",
  "matchId": "5660ca26-8e21-40bc-bfd6-8bd2a85c1409",
  "player": "Mahoraga#Chess"
}
```

---

### 1.5. Analisar Partida (Síncrono)
Processa a análise e retorna o resultado **imediatamente** na resposta HTTP. Recomendado para o Protocolo-V receber o insight na hora.

**Endpoint**: `POST /api/analyze`

**Request Payload**: O mesmo do endpoint `/api/queue` (Briefing).

**Response (200 OK)**:
```json
{
  "status": "completed",
  "matchId": "5660ca26-8e21-40bc-bfd6-8bd2a85c1409",
  "player": "Mahoraga#Chess",
  "insight": {
    "resumo": "Análise completa do comportamento tático...",
    "model_used": "gpt-4o"
  },
  "technical_data": {
    "performance_index": 82.5,
    "kd": 1.5,
    ...
  }
}
```

---

### 2. Consultar Status/Resultado da Análise
Retorna o estado atual de um processamento ou o resultado completo se finalizado.

**Endpoint**: `GET /api/status/{matchId}?player={playerTag}`

**Response (200 OK - Processing)**:
```json
{
  "status": "processing",
  "processed_at": "2026-03-23T21:00:00Z"
}
```

**Response (200 OK - Completed)**:
```json
{
  "status": "completed",
  "result": {
    "agent": "Jett",
    "map": "Ascent",
    "performance_index": 82.5,
    "holt": {
       "performance_L": 78.2,
       "performance_T": 1.5
    },
    "badges": ["Entry Fragger", "Op King"]
  }
}
```

---

### 3. Consultar Perfil do Jogador (Protocolo V)
Retorna dados agregados e tendências de um jogador.

**Endpoint**: `GET /api/v1/players/{id}`

**Response (200 OK)**:
```json
{
  "riotId": "Mahoraga#Chess",
  "rank": "Imortal 3",
  "mains": ["Jett", "Raze"],
  "stats": {
    "overall_kda": 1.45,
    "adr_trend": "+5.2%",
    "last_performance_index": 88.0
  }
}
```

---

### 5. Estatísticas Administrativas
Retorna o estado da fila de processamento e métricas de sistema.

**Endpoint**: `GET /api/admin/stats`

**Headers**:
- `x-api-key`: Chave administrativa mestra.

**Query Parameters**:
- `page`: Número da página (default: 1).
- `limit`: Quantidade de registros (default: 50).

**Response (200 OK)**:
```json
{
  "stats": {
    "total_records": 1250,
    "pending": 5,
    "page": 1,
    "limit": 50
  },
  "jobs": [...]
}
```

## Códigos de Erro

-   `400 Bad Request`: Parâmetros inválidos ou formatos (ex: Nick#Tag fora do padrão).
-   `401 Unauthorized`: API Key administrativa ausente ou inválida.
-   `404 Not Found`: Análise não localizada na fila.
-   `500 Internal Server Error`: Erro genérico de servidor para proteger informações internas.
