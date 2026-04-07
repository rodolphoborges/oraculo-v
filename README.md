# ORACULO V // MOTOR DE INTELIGENCIA TATICA v5.1

> Motor de analise tatica independente para o ecossistema Protocolo V.
> Transforma dados brutos de combate do Valorant em inteligencia estrategica via pipeline **Node.js nativo** e LLMs independentes.
> O Oraculo-V atua como um **Service Provider** sem reter os perfis duradouros dos jogadores.

Para compreender o fluxo de comunicacao de Webhooks e como este motor atende clientes externos sem partilhar banco de dados, consulte a documentacao global: [Relatorio de Arquitetura Global](https://github.com/rodolphoborges/protocolov/blob/main/ARCHITECTURE.md).

---

## Stack Tecnologica

| Camada | Tecnologia |
|---|---|
| API | Node.js (Express) |
| Motor Matematico | JavaScript nativo (`lib/analyze_valorant.js`) |
| Motor LLM | Tribunal Engine (3 personas) + Groq/OpenRouter/Ollama |
| Scraping | Puppeteer (tracker.gg) |
| Database | Supabase (banco proprio, soberano) |
| Comunicacao | Webhooks REST (callback para Protocolo-V) |

---

## Setup & Instalacao

### Pre-requisitos
- [Node.js](https://nodejs.org/) v18+
- Docker & Docker Compose (opcional, para rodar integrado ao Protocolo-V).

### Instalacao Standalone

```bash
git clone https://github.com/rodolphoborges/oraculo-v.git
cd oraculo-v
npm install
cp .env.example .env
```

### Orquestracao via Docker (Recomendado)
Para carregar todo o ecossistema de uma so vez, utilize o ambiente Docker na raiz principal:

```bash
cd .. # Direciona para a raiz de PROJETOS-V
docker-compose up --build
```

---

## Variaveis de Ambiente

> **SEGURANCA**: O `.env` contem chaves de servico Supabase locais, chaves de API restritas e endpoints. Nunca partilhe (`commit`) este arquivo.

| Variavel | Obrigatoriedade | Descricao |
|---|---|---|
| `SUPABASE_URL` | Obrigatorio | URL da Box Supabase Local (Fila do Oraculo) |
| `SUPABASE_SERVICE_KEY` | Obrigatorio | Chave Service Role (Oraculo) |
| `PROTOCOL_API_URL` | Obrigatorio | Endpoint alvo para enviar o Callback do Webhook apos processamento (`http://localhost:3000` se standalone, ou `http://protocolov:3000` via dock). |
| `ADMIN_API_KEY` | Obrigatorio | Chave Mestra partilhada com o Protocolo-V |
| `GROQ_API_KEY` | Opcional | Chave Groq (Llama 3.3 70B — provider primario do Tribunal) |
| `OPENROUTER_API_KEY` | Opcional | Chave OpenRouter (fallback cloud free tier) |
| `LOCAL_LLM_URL` | Opcional | URL do Ollama (`http://localhost:11434`) |
| `LOCAL_LLM_MODEL` | Opcional | Modelo Ollama (ex: `qwen2.5:7b`) |
| `PORT` | Opcional | Porta da Express API (Padrao: 3001) |

*(Nota: Variaveis `PROTOCOL_SUPABASE_URL` e `PROTOCOL_SUPABASE_KEY` sao usadas apenas como fallback direto caso o Webhook falhe. Nao sao obrigatorias.)*

---

## Execucao

O server e o worker iniciam **juntos** automaticamente:

```bash
npm start
```

O `server.js` escuta na porta configurada (padrao 3001) e invoca `startWorker()` automaticamente ao iniciar. Nao e necessario rodar o worker em terminal separado.

**Modo Worker isolado (opcional):**
```bash
npm run worker
```

**Analise direta via CLI (bypass da fila):**
```bash
node analyze_match.js "Nick#Tag" "UUID-DA-PARTIDA"
```

---

## Endpoints da API

| Metodo | Rota | Auth | Descricao |
|---|---|---|---|
| `POST` | `/api/queue` | `x-api-key` | Enfileira briefing para analise assincrona |
| `POST` | `/api/analyze` | `x-api-key` | Analise sincrona (retorna resultado imediato) |
| `GET` | `/api/status/:matchId` | Publico | Consulta status/resultado de analise |
| `POST` | `/api/chat` | `x-api-key` | Interacao direta com K.A.I.O. via LLM local |
| `GET` | `/api/ping` | Publico | Health check basico |
| `GET` | `/api/health` | Publico | Status do DB e fila |

Documentacao completa dos payloads em [API.md](./API.md).

---

## Arquitetura do Motor

### Pipeline de Analise (v5.1)

```
POST /api/queue (Protocolo-V envia briefing)
    |
    v
Supabase Queue (match_analysis_queue) [status: pending]
    |
    v
Worker captura job [status: processing]
    |
    v
1. getPlayerHoltState() — busca ultimas 3 partidas
2. runAnalysis() — Motor JS nativo (lib/analyze_valorant.js)
3. runTribunal() — Motor LLM 3 personas
4. Persistencia local (match_stats)
5. Webhook callback para Protocolo-V
    |
    v
Job DELETADO da fila apos sucesso
```

### Tribunal Engine (Motor LLM de 3 Personas)

O sistema de IA utiliza uma analise **adversarial** com tres perspectivas:

1. **Perspectiva Aliada** — Analisa suporte, sinergia e trades do time.
2. **Perspectiva Rival** — Analisa como o inimigo explorou fraquezas do jogador.
3. **Mentor K.A.I.O.** — Sintetiza o ensinamento final como Head Coach.

Cada persona utiliza um modelo LLM com fallback em cadeia:
- **Primario**: Groq (`llama-3.3-70b-versatile`)
- **Fallback 1**: OpenRouter (`gemini-2.0-flash-exp:free`, `llama-3.1-8b:free`)
- **Fallback 2**: Ollama local

Documentacao completa em [docs/llm_intelligence.md](./docs/llm_intelligence.md).

---

## Estrutura do Projeto

```
oraculo-v/
  server.js              # API Express + auto-start do Worker
  worker.js              # Consumer assincrono da fila (v5.1.0)
  analyze_match.js       # Orquestrador de analise (scraping + calculo)
  monitor_queue.js       # Monitor de status da fila
  lib/
    analyze_valorant.js  # Motor matematico: Performance Index, Holt-Winters
    tribunal_engine.js   # Motor LLM: 3 Personas (Aliado/Rival/Mentor)
    openrouter_engine.js # Fallback LLM + validacao anti-alucinacao
    tactical_knowledge.js# Base tatica: agentes, mapas, arsenal
    valorant_api.js      # Consulta habilidades de agentes
    supabase.js          # Conexao soberana ao banco do Oraculo
  scrapers/              # Modulos de scraping (tracker.gg via Puppeteer)
  scripts/               # Ferramentas de manutencao e auditoria
  schemas/               # Schemas de validacao
  models/                # Modelos de dados
  analyses/              # Cache local de relatorios JSON
  matches/               # Cache local de dados brutos de partidas
  public/                # Dashboard admin (frontend estatico)
  docs/                  # Documentacao tecnica detalhada
```

---
*Oraculo V v5.1.0 — Dados entram. Inteligencia sai.*
