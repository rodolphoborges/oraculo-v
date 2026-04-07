# Motor de Inteligencia LLM — Tribunal Engine (v5.1)

O Oraculo-V v5.1 utiliza o **Tribunal Engine**, um motor de IA adversarial com 3 personas, acoplado ao ecossistema assincrono.

## 1. O Problema Fundamental: "Token Overflow"

A maioria dos sistemas falha ao tentar mandar o JSON inteiro de uma API direto para a Inteligencia Artificial. Isso e caro, ineficiente e disperso (tokens estouram e a IA "alucina").

O Oraculo **nunca** envia a partida bruta diretamente. Ele atua como um Afunilador:

1. A partida roda no motor JS nativo (`lib/analyze_valorant.js`).
2. O JS decodifica a performance calculando metricas estritas (K/D, ACS, Holt-Winters, Performance Index).
3. Essa matematica ja polida se torna a `Prompt Foundation`. A IA nao tem a obrigacao de calcular nada, apenas atuar como analista de coaching.

## 2. Tribunal Engine — 3 Personas

A partir da v5.1, o motor LLM utiliza um sistema de analise adversarial:

### Persona 1: Perspectiva Aliada
- Analisa suporte, sinergia e trades do time aliado
- Defende o jogador mostrando contexto favoravel
- Modelo: Groq (`llama-3.3-70b-versatile`) -> OpenRouter (`gemini-2.0-flash-exp:free`)

### Persona 2: Perspectiva Rival
- Analisa como o time inimigo explorou fraquezas
- Acusa falhas de posicionamento e decisao
- Modelo: Groq (`llama-3.3-70b-versatile`) -> OpenRouter (`llama-3.1-8b:free`)

### Persona 3: Mentor K.A.I.O.
- Sintetiza ambas as perspectivas no ensinamento final
- Atua como Head Coach, gerando conselho definitivo
- Modelo: Groq (`llama-3.3-70b-versatile`) -> OpenRouter (`gemini-2.0-flash-exp:free`)

### Contexto Tatico por Persona
Cada persona recebe:
- Dados completos da partida (JSON do tracker.gg)
- Stats detalhados de ambos os times (aliados e inimigos)
- Base tatica completa (`tactical_knowledge.js`): agentes, mapas, habilidades, sites validos
- Obrigacoes por role e missao do agente especifico (`getRoleObligations`, `getAgentMission`)

## 3. Resiliencia: Arquitetura de Fallback

### Fallback do Tribunal
Se o Tribunal Engine falhar (ex: JSON da partida nao disponivel localmente), o sistema recorre ao `generateInsights()` do `openrouter_engine.js`, que usa uma abordagem single-prompt mais simples.

### Cadeia de Fallback por Provider (OpenRouter Engine)
1. `meta-llama/llama-3.3-70b-instruct:free` (Primario)
2. `google/gemma-3-12b-it:free` (1o Fallback Nuvem)
3. `qwen/qwen3-4b:free` (2o Fallback Nuvem)

### Saida de Emergencia (Ollama Local)
Se a nuvem inteira colapsar, o sistema dispara para o host local via Ollama:
- Variaveis: `LOCAL_LLM_URL` e `LOCAL_LLM_MODEL`
- O parser do Node remove tags XML `<think>` do modelo `deepseek-r1`

## 4. Validacao Anti-Alucinacao

O `validateInsightQuality()` em `openrouter_engine.js` expurga insights que contenham:
- Caracteres nao-latinos
- Termos banidos
- Sites inexistentes no mapa (ex: "Site C" em Breeze)
- Violacoes geograficas e factuais

## 5. Endpoint de Chat Direto

Alem do Tribunal (usado na pipeline de analise), o Oraculo oferece o endpoint `POST /api/chat` para interacao direta com K.A.I.O.:
- Usa exclusivamente Ollama local (modelo configuravel)
- Recebe a base tatica completa como system prompt via `getGlobalStrategicSummary()`
- Nao faz parte da pipeline de analise — e uma feature independente

## 6. Historico de Evolucao do Motor LLM

| Versao | Motor | Descricao |
|---|---|---|
| v4.0 | OpenRouter (single prompt) | Prompt unico com dados do Python |
| v4.1 | OpenRouter + Ollama fallback | Adicionado fallback local |
| v5.0 | OpenRouter + Groq | Dados agora vem do motor JS |
| v5.1 | Tribunal Engine (3 personas) | Analise adversarial com Groq/OpenRouter/Ollama |
