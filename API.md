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
    "performance_index": 118.5,
    "performance_status": "ELITE DO PROTOCOLO",
    "estimated_rank": "Alpha",
    "kd": 1.5,
    "target_kd": 1.0,
    "acs": 285,
    "adr": 165.5,
    "conselho_kaio": {
      "diagnostico_principal": "Entry frag consistente com leitura de timing superior...",
      "pontos_fortes": ["Conversao de trades em rounds de pistol", "Uso de clones para controle de area"],
      "pontos_fracos": ["Posicionamento pos-plant expondo angulo desnecessario"],
      "nota_coach": "8.5"
    },
    "rounds": []
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

---

### 6. Histórico de Análises Completas
Retorna as análises concluídas armazenadas na tabela `ai_insights` do Protocolo-V.

**Endpoint**: `GET /api/admin/history`

**Headers**:
- `x-api-key`: Chave administrativa mestra.

**Response (200 OK)**:
```json
{
  "total": 42,
  "analyses": [
    {
      "id": "uuid",
      "match_id": "uuid",
      "agente_tag": "ousadia#013",
      "impact_score": 112.5,
      "created_at": "2026-03-30T10:00:00Z"
    }
  ]
}
```

---

### 7. Apagar Análise Individual
Remove uma análise específica de ambos os bancos Supabase (Oráculo e Protocolo) e o arquivo local correspondente.

**Endpoint**: `DELETE /api/admin/analysis`

**Headers**:
- `x-api-key`: Chave administrativa mestra.

**Request Payload**:
```json
{
  "match_id": "uuid-da-partida",
  "player_id": "Nick#Tag"
}
```

**Response (200 OK)**:
```json
{
  "message": "Análise deletada com sucesso",
  "match_id": "uuid",
  "player_id": "Nick#Tag"
}
```

---

### 8. Apagar Todas as Análises
Remove todas as análises de ambos os bancos e arquivos locais.

**Endpoint**: `DELETE /api/admin/analysis/all`

**Headers**:
- `x-api-key`: Chave administrativa mestra.

**Response (200 OK)**:
```json
{
  "message": "Todas as análises foram deletadas",
  "deleted_count": 42,
  "local_files_deleted": 42
}
```

---

### 9. Reprocessar Análise
Apaga a análise existente e re-executa `processBriefing()` para gerar uma nova análise com sync completo para Protocolo-V.

**Endpoint**: `POST /api/admin/reprocess`

**Headers**:
- `x-api-key`: Chave administrativa mestra.

**Request Payload**:
```json
{
  "match_id": "uuid-da-partida",
  "player_id": "Nick#Tag"
}
```

**Response (200 OK)**:
```json
{
  "message": "Reprocessamento concluído",
  "rank": "Alpha",
  "score": 118.5
}
```

## Códigos de Erro

-   `400 Bad Request`: Parâmetros inválidos ou formatos (ex: Nick#Tag fora do padrão).
-   `401 Unauthorized`: API Key administrativa ausente ou inválida.
-   `404 Not Found`: Análise não localizada na fila.
-   `500 Internal Server Error`: Erro genérico de servidor para proteger informações internas.
