# ORÁCULO V // MOTOR DE INTELIGÊNCIA TÁTICA v4.1

> Motor de análise tática independente para o ecossistema Protocolo V.
> Transforma dados brutos de combate do Valorant em inteligência estratégica via pipeline Node.js e LLMs independentes.
> O Oráculo-V atua como um humilde **Service Provider** sem reter os perfis duradouros dos jogadores.

Para compreender o fluxo de comunicação de Webhooks e como este motor atende clientes externos sem partilhar banco de dados, consulte nossa documentação global: [Relatório de Arquitetura Global](https://github.com/rodolphoborges/protocolov/blob/main/ARCHITECTURE.md).

---

## 🚀 Setup & Instalação

### Pré-requisitos
- [Node.js](https://nodejs.org/) v18+
- Docker & Docker Compose (opcional, para rodar integrado ao Protocolo-V).

### Instalação Standalone

```bash
git clone https://github.com/rodolphoborges/oraculo-v.git
cd oraculo-v
npm install
cp .env.example .env
```

### Orquestração via Docker (Recomendado)
Para carregar todo o ecossistema de uma só vez, utilize o ambiente Docker na raiz principal. O Oráculo-V e suas filas subirão paralelizados.

```bash
cd .. # Direciona para a raiz de PROJETOS-V
docker-compose up --build
```

---

## 🔑 Variáveis de Ambiente

> **SEGURANÇA**: O `.env` contém chaves de serviço Supabase locais, chaves de API restritas e endpoints. Nunca partilhe (`commit`) este arquivo fora de *vaults* encriptados.

| Variável | Obrigatoriedade | Descrição |
|---|---|---|
| `SUPABASE_URL` | Obrigatório | URL da Box Supabase Local (Fila do Oráculo) |
| `SUPABASE_SERVICE_KEY` | Obrigatório | Chave Service Role (Oráculo) |
| `PROTOCOL_API_URL` | Obrigatório | Endpoint alvo para enviar o Callback do Webhook após processamento (`http://localhost:3000` se standalone, ou `http://protocolov:3000` via dock). |
| `ADMIN_API_KEY` | Obrigatório | Chave Mestra partilhada com o Protocolo-V (Para acionar endpoint de callback do webhook/telemetria local) |
| `OPENROUTER_API_KEY` | Opcional | Chave OpenRouter (fallback cloud free tier/pagos) |
| `GROQ_API_KEY` | Opcional | Chave Groq (Llama 3 70B Fast inference) |
| `LOCAL_LLM_URL` | Opcional | URL do Ollama (`http://localhost:11434`) |
| `LOCAL_LLM_MODEL` | Opcional | Modelo Ollama (`qwen2.5:7b`) |
| `PORT` | Opcional | Porta da Express API (Padrão: 3001) |

*(Nota: Referências diretas ao banco de dados `PROTOCOL_SUPABASE_URL` foram extintas na v4.0)*

---

## 💻 Execução Manual e Scripts (Standalone)

Para operar perfeitamente sem orquestração com Docker/Concurrently, o serviço divide-se em 2 terminais.

**Terminal 1 — Receptor HTTPS de Briefings (Endpoint API):**
```bash
npm start
```

**Terminal 2 — O Analítico Silencioso (Consumidor Assíncrono):**
```bash
npm run worker
```

**Injeção Clandestina (Bypass da fila para gerar relatório cru terminal):**
```bash
node analyze_match.js "Nick#Tag" "UUID-DA-PARTIDA"
```

---

## 🧪 Estrutura Simplificada (Overview)

```
oraculo-v/
  server.js              # API Express Puxador (Porta de Entrada)
  worker.js              # Engine Autônoma que Despacha os Webhooks
  analyze_match.js       # Orquestrador Analítico Principal 
  lib/                   # Módulos do Motor
    analyze_valorant.js  # Táticas, Holt-Winters, Performance Index
    openrouter_engine.js # Fallback Strategy LLMs + Dicionários
```
---
*Oráculo V: Dados entram. Inteligência sai.*
