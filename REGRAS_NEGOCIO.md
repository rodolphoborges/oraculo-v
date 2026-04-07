# Oraculo V | Regras de Negocio e Dominio Tatico (v5.1)

Este documento detalha o funcionamento interno do motor de analise do **Oraculo V**, explicando como as estatisticas brutas do Valorant sao transformadas em inteligencia tatica interpretavel.

---

## 1. Performance Index (Fonte Unica de Verdade)

### Calculo Contextual por Classe de Agente

O **Performance Index** e a metrica central do Oraculo V. Ele avalia o desempenho do jogador de forma **contextual**, ponderando K/D, ADR e KAST com pesos diferentes por classe de agente:

```
Performance Index = (KD_Weight x KD% + ADR_Weight x ADR% + KAST_Weight x KAST%) x 100
```

Onde:
- `KD%` = K/D Real / K/D Alvo (vStats.gg por agente/mapa/rank)
- `ADR%` = ADR / ADR Baseline (definido por classe)
- `KAST%` = KAST / 100

### Pesos por Classe (Role-Aware Thresholds) — v4.2

| Classe       | KD Peso | ADR Peso | KAST Peso | ADR Baseline | KAST Min. |
|-------------|---------|----------|-----------|-------------|-----------|
| **Duelista**    | 45%     | 55%      | 0%        | 150         | 60%       |
| **Iniciador**   | 20%     | 30%      | 50%       | 100         | 68%       |
| **Controlador** | 15%     | 20%      | 65%       | 85          | 72%       |
| **Sentinela**   | 15%     | 20%      | 65%       | 88          | 68%       |

> **Nota**: Estes sao os pesos implementados em `lib/analyze_valorant.js` (v4.2). A versao anterior (v4.1) usava pesos diferentes (Duelista 40/40/20, etc.) que foram descontinuados.

*   **Filosofia**: A classe do agente determina as expectativas. Um Duelista e avaliado mais por K/D e ADR, enquanto um Controlador e avaliado mais por sobrevivencia (KAST).
*   **Base**: O K/D Alvo e obtido em tempo real via **vStats.gg**, filtrado por agente, mapa e rank.
*   **100** = desempenho exatamente na meta. Acima = superou, abaixo = ficou aquem.

### Os Tres Niveis Tecnicos

| Rank                    | Performance Index | Significado                                   |
|------------------------|-------------------|-----------------------------------------------|
| **Alpha**            | >= 115             | Performance excepcional acima da meta          |
| **Omega**            | 95 - 114          | Desempenho consistente dentro do esperado      |
| **Deposito de Torreta** | < 95              | Desempenho abaixo da meta para o contexto      |

Cada rank gera uma **tone_instruction** que orienta a LLM sobre como formular o feedback (elogio, neutralidade ou critica).

### Principio Anti-Contradicao

Na v4.0 foi eliminada a **dupla avaliacao**. Antes, dois sistemas independentes (Python e ImpactAnalyzer.js) geravam resultados que podiam se contradizer. Agora, o motor JS nativo (`lib/analyze_valorant.js`) e a **unica fonte de verdade**, garantindo coerencia total entre metricas e conselhos.

> **Historico**: O motor Python (`analyze_valorant.py`) foi a fonte de verdade ate a v4.1. Na v5.0, todo o calculo foi migrado para JavaScript nativo, eliminando o overhead de spawn de processos Python.

---

## 2. Modelo Preditivo (Holt-Winters)

O Oraculo V utiliza o algoritmo **Double Exponential Smoothing (Holt-Winters)** para analisar a evolucao do jogador ao longo do tempo. Os estados sao persistidos na tabela `match_stats` do Oraculo-V e devolvidos ao Protocolo-V via webhook.

### Nivel Atual (Level - L)
Representa a base tecnica estavel do jogador. Ele "limpa" o ruido de partidas atipicas, mostrando o nivel real de entrega no longo prazo.

### Tendencia (Trend - T)
Mede a aceleracao da performance.
*   **T > 0**: Evolucao tecnica e melhora constante.
*   **T < 0**: Alerta para queda de rendimento ou perda de ritmo.

### Proxima Partida (Forecast)
Projecao matematica (`L + T`) da performance esperada no proximo combate.

### Parametros
*   **alpha (Smoothing Level)**: 0.4
*   **beta (Smoothing Trend)**: 0.2 (REGRAS_NEGOCIO) / 0.15 (implementacao Protocolo-V)
*   **Inicializacao**: Baseada nas ultimas 3 partidas do jogador (via `match_stats`).

---

## 3. Tribunal Engine (Motor de IA Adversarial)

A partir da v5.0, o Oraculo V utiliza o **Tribunal Engine** — um sistema de analise adversarial com tres personas LLM:

### As 3 Perspectivas

1. **Perspectiva Aliada** — Analisa o suporte, sinergia e trades do time aliado. Defende o jogador mostrando contexto favoravel.
2. **Perspectiva Rival** — Analisa como o time inimigo explorou fraquezas do jogador. Acusa falhas de posicionamento e decisao.
3. **Mentor K.A.I.O.** — Sintetiza ambas as perspectivas num ensinamento final como Head Coach. Gera o conselho definitivo.

### Cadeia de Fallback por Persona

| Prioridade | Provider | Modelo |
|---|---|---|
| 1 (Primario) | Groq | `llama-3.3-70b-versatile` |
| 2 (Fallback) | OpenRouter | `gemini-2.0-flash-exp:free` / `llama-3.1-8b:free` |
| 3 (Emergencia) | Ollama Local | Configuravel via `LOCAL_LLM_MODEL` |

### Contexto Tatico
Cada persona recebe como contexto:
- Dados completos da partida (JSON do tracker.gg)
- Stats de ambos os times (aliados e inimigos)
- Base tatica completa (agentes, mapas, habilidades, sites validos)
- Obrigacoes por role e missao do agente especifico

### Validacao Anti-Alucinacao
O sistema valida a qualidade dos insights gerados, expurgando:
- Caracteres nao-latinos
- Termos banidos ou sites inexistentes
- Violacoes geograficas (ex: mencionar "Site C" em mapa com apenas A e B)

---

## 4. Fluxo de Fila (Queue)

### Ciclo de Vida do Job
1. **Pendente**: Job enfileirado em `match_analysis_queue` com status `pending`.
2. **Processando**: Worker captura o job e atualiza para `processing`.
3. **Concluido**: Job e **DELETADO** da fila. Resultado persiste em `match_stats` e e enviado via webhook.
4. **Falhado**: Job permanece na fila com status `failed` e mensagem de erro.

> **Importante**: Jobs concluidos NAO sao marcados como "completed" — sao removidos da fila. A fila contem apenas jobs ativos (pending/processing/failed).

### Timeout Global
Cada processamento tem um timeout maximo de **5 minutos** (300.000ms). Se excedido, o job e marcado como falha com erro `TIMEOUT_LIMIT_REACHED`.

---

## 5. Identidade e Validacao

### Soberania do Proprietario
*   **Dono do Projeto (Telegram)**: `1104821838`
*   **Agente de Validacao Principal**: `ousadia#013`

---
*(C) 2026 DEEPMIND ANTIGRAVITY // NUCLEO_TATICO_V5.1*
