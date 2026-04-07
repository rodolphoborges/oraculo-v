# Guia de Testes // Operacao Oraculo V (v5.1)

## 1. Subir o Servidor + Worker

O servidor e o worker iniciam juntos automaticamente:

```bash
npm start
```

O console devera exibir:
```
[ORACULO-V] Servidor ativo em http://localhost:3001
[ORACULO-V] Worker v5.1.0 Ativo.
```

> **Nota**: Na v5.1, o worker inicia automaticamente com o server via `startWorker()`. Nao e necessario rodar em terminal separado.

---

## 2. Testar o Enfileiramento (API Queue)

Use outro terminal (ou Insomnia/Postman) para enviar uma partida para a fila.

**Via PowerShell:**
```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/queue" -ContentType "application/json" -Body '{"player_id":"OUSADIA#013", "match_id":"5525faf5-034e-4caf-b142-9d9bc8a3e897"}'
```

**Via cURL:**
```bash
curl -X POST http://localhost:3001/api/queue \
  -H "Content-Type: application/json" \
  -d '{"player_id":"OUSADIA#013", "match_id":"5525faf5-034e-4caf-b142-9d9bc8a3e897"}'
```

**Resposta esperada (202):**
```json
{
  "message": "Job enfileirado no Oraculo-V.",
  "matchId": "5525faf5-034e-4caf-b142-9d9bc8a3e897",
  "player": "OUSADIA#013"
}
```

---

## 3. Verificar Health Check

```bash
curl http://localhost:3001/api/health
```

**Resposta esperada:**
```json
{
  "status": "ok",
  "service": "Oraculo-V",
  "db": { "connected": true },
  "queue": { "pending": 1 }
}
```

---

## 4. Consultar Status da Analise

Apos o worker processar o job:

```bash
curl "http://localhost:3001/api/status/5525faf5-034e-4caf-b142-9d9bc8a3e897?player=OUSADIA%23013"
```

**Se concluido:**
```json
{
  "status": "completed",
  "result": { "..." }
}
```

---

## 5. Pipeline de Processamento

Ao observar os logs do worker, o fluxo completo sera:

```
[WORKER] >>> INICIANDO: OUSADIA#013 | Match: 5525faf5-...
  [1/5] Carregando estado Holt-Winters...
  [2/5] Executando Motor Tatico (analyze_match.js)...
  [3/5] Gerando Insights de IA (Tribunal)...
  [4/5] Persistindo dados no Oraculo-V...
  [5/5] Executando Callback para o Protocolo-V...
  [CALLBACK] Webhook finalizado.
[QUEUE] Job xxx removido apos sucesso.
```

O motor de IA utilizara o **Tribunal Engine** (3 personas via Groq/OpenRouter) ou o fallback `generateInsights()` se o JSON da partida nao estiver disponivel localmente.

---

## 6. Testes Automatizados

```bash
npm test
```

Executa a suite Jest configurada no projeto. Para testes de integracao ponta-a-ponta, certifique-se de que o servidor esta rodando.

---

## 7. Analise Direta (Bypass da Fila)

Para testar o motor de analise sem passar pela fila:

```bash
node analyze_match.js "OUSADIA#013" "5525faf5-034e-4caf-b142-9d9bc8a3e897"
```

---

## 8. Monitor de Fila

Para monitorar o estado da fila em tempo real:

```bash
node monitor_queue.js
```

---
*(C) 2026 DEEPMIND ANTIGRAVITY // PROTOCOLO_V_READY*
