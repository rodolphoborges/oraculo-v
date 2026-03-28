# Guia de Testes // Operação Oráculo V

Siga este protocolo para validar todas as funcionalidades do sistema v4.0.

## 1. Subir o Servidor (Dashboard & API)
Abra um terminal e execute:
```bash
npm start
```
O console deverá exibir: `Oráculo V Dashboard rodando em http://localhost:3000`

---

## 2. Testar o Enfileiramento (API Queue)
Abra um **segundo terminal** (ou use Insomnia/Postman) para enviar uma partida para a fila.

**Via PowerShell (Recomendado):**
```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/queue" -ContentType "application/json" -Body '{"player":"OUSADIA#013", "matchId":"5525faf5-034e-4caf-b142-9d9bc8a3e897"}'
```

**Via cURL:**
```bash
curl -X POST http://localhost:3000/api/queue -H "Content-Type: application/json" -d '{"player":"OUSADIA#013", "matchId":"5525faf5-034e-4caf-b142-9d9bc8a3e897"}'
```

---

## 3. Ligar o Motor Assíncrono (Worker)
O sistema é assíncrono e feito para rodar em Loop Contínuo. Para ligar o motor que consumirá a fila:
*(Certifique-se que o Ollama / Local LLM esteja rodando se não for usar OpenRouter).*
```bash
node worker.js
```
Acompanhe os logs: Ele puxará os dados, identificará grupamentos (se modo 'AUTO'), passará a partida para o Python local, invocará o Motor de IA (OpenRouter/Ollama) e voltará a dormir no aguardo de mais jobs na fila.

---

## 4. Validar no Console Admin
1.  Acesse: `http://localhost:3000/admin.html`
2.  Verifique se o contador de **Jobs Completados** aumentou.
3.  Localize a partida na tabela e clique no botão **`[ ABRIR ]`** na coluna de Ações.

---

## 5. Verificação de Imersão (Deep Link)
Ao clicar em `[ ABRIR ]`, você deve ser levado ao dashboard principal.
- **Deverá ver**: Uma simulação de terminal digitando `analyze --player OUSADIA#013...`
- **Deverá ver**: O relatório detalhado com os **Artigos da Constituição** citados pelo K.A.I.O. Advisor.

---

## 6. Testes Automatizados (Bateria Ponta-a-Ponta)
Se precisar checar de modo absoluto a saúde da infraestrutura (Por ex: se o Schema de DB mudou), há uma suíte local. Com o `server.js` e `worker.js` rodando em outras abas, apenas execute:
```bash
node run_e2e_test.js
```
Ele injetará um pacote teste, fará `polling` do status na API simulando o front-end, e validará que o pipeline inteiro do Python sobreviveu à atualização sem a necessidade de intervenção humana.

---
*(C) 2026 DEEPMIND ANTIGRAVITY // PROTOCOLO_V_READY*
