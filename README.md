# ORÁCULO V // NÚCLEO_TÁTICO v3.0

O **Oráculo V** é um **Motor de Análise Tática de Elite** de arquitetura assíncrona. Nesta versão v3.0, ele opera como um microserviço independente que monitora jogadores dO **Protocolo-V** e gerencia sua própria fila de tarefas sob a estética "Brutalista Terminal".

> [!NOTE]
> **[AI/LLM ENTRY POINT - V3.0 UPDATED]**
> Future AI agents should start by reviewing `lib/supabase.js` for dual-database setup, and `worker.js` which acts as a **continuous asynchronous daemon (while loop)** processing the queue.
> 
> **CRITICAL DB CONTEXT:** The primary queue table in Supabase (`match_analysis_queue`) specifically uses `agente_tag` (NOT `player_riot_id`) and `error_msg` (NOT `error_message`). Keep this in mind to avoid silent SQL update errors. The final JSON report output by the engine is saved into the `metadata.analysis` JSONB property.
> 
> Core domain rules (Lexicon of Impact) are implemented in `analyze_valorant.py`.
> Integration and regression tests should be executed via `node run_e2e_test.js`.
> Connectivity diagnostics can be run via `node check_tables_v2.js`.

## 🏗️ Arquitetura Multi-Base (Microserviços)

O Oráculo V agora suporta conexão simultânea a dois projetos Supabase:
- **Base Fonte (Protocolo-V)**: Onde residem os jogadores cadastrados e o banco de dados principal.
- **Base de Operações (Oráculo-V)**: Onde o motor gerencia sua própria fila de processamento (`match_analysis_queue`).

## 🚨 Funcionalidades de Elite (v3.0)

- **Radar de Descoberta**: Escaneia jogadores da base externa, busca historico de partidas e cria tarefas individuais na fila para cada agente registrado.
- **Worker Puro (Expertise Engine)**: Motor de processamento assíncrono especializado. Ele não faz "descoberta" de jogadores; apenas executa a análise técnica tática sobre tarefas específicas `{match_id, agente_tag}`.
- **Integração Serverless**: Relatórios JSON (`metadata.analysis`) acessíveis de forma estática pelo frontend diretamente no Supabase.
- **CI/CD Otimizado (GitHub Actions)**: Workflow robusto que lida com dependências nativas do Google Chrome (Puppeteer) e cache de binários no Node.js v22.
- **Diagnóstico Híbrido**: Verificação em tempo real da saúde das duas conexões de banco de dados.

## 📂 Estrutura do Projeto

- `discover_matches.js`: Radar principal. Descobre partidas em grupo e preenche a fila de análise. É o responsável por "caminhar" pelos jogadores e consumir APIs de descoberta.
- `worker.js`: Motor de análise puro. Monitora a fila e executa o motor Python. É cego para a descoberta; foca 100% na expertise técnica.
- `lib/supabase.js`: Core de conexão dual-database.
- `check_tables_v2.js`: Diagnóstico de conectividade multi-base.
- `analyze_valorant.py`: Motor de análise tática e narrativa em Python.
- `run_e2e_test.js`: Bateria automatizada de testes locais de Ponta-a-Ponta.

## 🌐 Endpoints da API (`server.js`)
O sistema emite um painel admin e 4 rotas centrais:
1. `POST /api/queue`: (Body: `{ player: "Nick#Tag" | "AUTO", matchId: "UUID" }`) - Enfileira uma análise técnica. O modo `AUTO` identifica e enfileira automaticamente todos os agentes do Protocolo V presentes na partida.
2. `GET /api/status/:matchId?player=Nick#Tag`: Retorna o status atual de processamento e, se `'completed'`, anexa o JSON parcial do resultado.
3. `GET /api/admin/stats`: Retorna as estatísticas do servidor para consumo do `admin.html`.
4. `GET /api/status/:matchId?player=Nick#Tag`: (v3.1) Agora retorna o objeto completo de análise dentro de `job.metadata.analysis`.

## 📘 Guia para Consumidores de Dados (Frontend)

Se você é uma **IA/LLM** trabalhando no frontend (ex: **Protocolo-V**), use este guia para renderizar os relatórios do Oráculo-V corretamente.

### 1. Estrutura do Objeto de Análise (`metadata.analysis`)

Os dados finais estão no objeto `analysis`. Campos principais:
- `performance_index`: (Number) Taxa de performance (100 = média).
- `performance_status`: `'ABOVE_BASELINE'` ou `'BELOW_BASELINE'`.
- `estimated_rank`: (String) Rank sugerido (Ex: "RADIANTE").
- `target_kd`: (Number) K/D médio esperado para o rank desse agente.
- `conselho_kaio`: (String) Texto longo com a DIRETRIZ TÁTICA principal (Artigo de Impacto).
- `acs`, `adr`, `kd`: Métricas gerais da partida.

### 2. Lista de Rounds (`rounds[]`)

Cada item no array `rounds` representa uma rodada analisada:
- `round`: (Number) Número do round.
- `comment`: (String | **NOVO**) Resumo narrativo do round (Ex: "Amassou no site B..."). **Use este campo como fallback principal.**
- `impacto`: (String | **NOVO**) `'Positivo'`, `'Negativo'` ou `'Neutro'`. Use para colorir o round.
- `kills`: (Number | **NOVO**) Quantidade de abates no round.
- `pos` / `neg`: (String) Eventos específicos positivos/negativos destacados.
- `narrative[]` / `eventos[]`: Array de eventos detalhados com carimbo de tempo.
    - Cada evento tem: `time` (MM:SS), `text` (ou `texto`), `type` (ou `tipo`).

### 3. Dicas de UI para LLMs (Protocolo-V)

- **Box kaio**: Sempre exiba `conselho_kaio` em destaque (Ex: Terminal Box ou Alerta).
- **Lista de Rounds**: Intere sobre `analysis.rounds`. Se `comment` estiver presente, exiba-o. Se não, use `pos` ou `neg`.
- **Compatibilidade**: O motor v3.1+ fornece campos tanto em Inglês (`text`, `type`) quanto em Português (`texto`, `tipo`). Priorize os campos em Português se existirem para manter a consistência do Protocolo-V.

## ⚙️ Configuração

1. **Instalação**: `npm install`
2. **Setup**: Renomeie `.env.example` para `.env` e preencha as chaves:

### Oráculo V (Banco de Tarefas)
- `SUPABASE_URL`: URL do projeto do Oráculo.
- `SUPABASE_SERVICE_KEY`: Key `service_role` dO Oráculo.

### Protocolo V (Fonte de Dados)
- `PROTOCOL_SUPABASE_URL`: URL do projeto do Protocolo.
- `PROTOCOL_SUPABASE_KEY`: Key `service_role` dO Protocolo.

### APIs de Terceiros
- `HENRIK_API_KEY`: Chave da API HenrikDev.
- `TELEGRAM_BOT_TOKEN`: Token do Bot dO Telegram.

## 🤖 Operação e Testes

### Diagnóstico de Base
Para validar se as duas conexões e tabelas estão prontas:
```bash
node check_tables_v2.js
```

### Radar de Partidas
Para buscar manualmente novas partidas em grupo:
```bash
node discover_matches.js
```

---
*(C) 2026 DEEPMIND ANTIGRAVITY // PROTOCOLO_V_OPERACAO_MAXIMA*
