# Oráculo V | Documentação da API

Esta documentação descreve os padrões de comunicação e endpoints do microsserviço Oráculo V.

## Padrões de Comunicação

-   **Protocolo**: HTTPS
-   **Formato**: JSON (Content-Type: `application/json`)
-   **Padrão**: RESTful
-   **Autenticação**: JWT (JSON Web Token) via header `Authorization: Bearer <token>`
    -   Nota: Atualmente em fase de implementação para ambiente de produção.

## Endpoints Principais

### 1. Enfileirar Análise de Partida
Solicita que o Oráculo processe uma partida específica para um jogador.

**Endpoint**: `POST /api/v1/queue`

**Request Payload**:
```json
{
  "player": "Mahoraga#Chess",
  "matchId": "5660ca26-8e21-40bc-bfd6-8bd2a85c1409"
}
```

**Response (201 Created)**:
```json
{
  "jobId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "status": "pending",
  "message": "Solicitação enfileirada com sucesso."
}
```

---

### 2. Consultar Status/Resultado da Análise
Retorna o estado atual de um processamento ou o resultado completo se finalizado.

**Endpoint**: `GET /api/v1/status/{matchId}?player={playerTag}`

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

### 4. Gerenciamento de Equipes
Criação e registro de novas organizações/times no Protocolo V.

**Endpoint**: `POST /api/v1/teams`

**Request Payload**:
```json
{
  "name": "Astralis Brasil",
  "shortName": "ASB",
  "captainId": "user_id_uuid"
}
```

**Response (201 Created)**:
```json
{
  "teamId": "772ac10b-58cc-4372-a567-0e02b2c3d987",
  "status": "active"
}
```

## Códigos de Erro

-   `400 Bad Request`: Parâmetros inválidos ou formatos (ex: UUID inválido).
-   `401 Unauthorized`: Token ausente ou expirado.
-   `404 Not Found`: Partida ou Jogador não localizado na base.
-   `500 Internal Server Error`: Falha crítica no processamento ou banco de dados.
