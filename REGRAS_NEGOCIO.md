# Oráculo V | Regras de Negócio e Domínio Tático (v4.1)

Este documento detalha o funcionamento interno do motor de análise do **Oráculo V**, explicando como as estatísticas brutas do Valorant são transformadas em inteligência tática interpretável.

---

## 1. Performance Index (Fonte Única de Verdade)

### Cálculo Contextual por Classe de Agente

O **Performance Index** é a métrica central do Oráculo V. Ele avalia o desempenho do jogador de forma **contextual**, ponderando K/D, ADR e KAST com pesos diferentes por classe de agente:

```
Performance Index = (KD_Weight × KD% + ADR_Weight × ADR% + KAST_Weight × KAST%) × 100
```

Onde:
- `KD%` = K/D Real / K/D Alvo (vStats.gg por agente/mapa/rank)
- `ADR%` = ADR / ADR Baseline (definido por classe)
- `KAST%` = KAST / 100

### Pesos por Classe (Role-Aware Thresholds)

| Classe       | KD Peso | ADR Peso | KAST Peso | ADR Baseline | KAST Mín. |
|-------------|---------|----------|-----------|-------------|-----------|
| **Duelista**    | 40%     | 40%      | 20%       | 160         | 65%       |
| **Iniciador**   | 35%     | 35%      | 30%       | 140         | 68%       |
| **Controlador** | 30%     | 30%      | 40%       | 120         | 72%       |
| **Sentinela**   | 30%     | 30%      | 40%       | 110         | 72%       |

*   **Filosofia**: A classe do agente determina as expectativas. Um Duelista é avaliado mais por K/D e ADR, enquanto um Controlador é avaliado mais por sobrevivência (KAST).
*   **Base**: O K/D Alvo é obtido em tempo real via **vStats.gg**, filtrado por agente, mapa e rank.
*   **100** = desempenho exatamente na meta. Acima = superou, abaixo = ficou aquém.

### Os Três Níveis Técnicos

| Rank                    | Performance Index | Significado                                   |
|------------------------|-------------------|-----------------------------------------------|
| 🥇 **Alpha**            | ≥ 115             | Performance excepcional acima da meta          |
| 🔷 **Omega**            | 95 – 114          | Desempenho consistente dentro do esperado      |
| 💔 **Depósito de Torreta** | < 95              | Desempenho abaixo da meta para o contexto      |

Cada rank gera uma **tone_instruction** que orienta a LLM sobre como formular o feedback (elogio, neutralidade ou crítica).

### Princípio Anti-Contradição
Na v4.0 foi eliminada a **dupla avaliação**. Antes, dois sistemas independentes (Python e ImpactAnalyzer.js) geravam resultados que podiam se contradizer (ex: K/D 15% abaixo da meta com feedback positivo). Agora, o motor Python é a **única fonte de verdade**, garantindo coerência total entre métricas e conselhos.

---

## 2. Modelo Preditivo (Holt-Winters)

O Oráculo V utiliza o algoritmo **Double Exponential Smoothing (Holt-Winters)** para analisar a evolução do jogador ao longo do tempo. Os estados são persistidos na tabela `players` do Protocolo-V.

### Nível Atual (Level - L)
Representa a base técnica estável do jogador. Ele "limpa" o ruído de partidas atípicas, mostrando o nível real de entrega no longo prazo.

### Tendência (Trend - T)
Mede a aceleração da performance.
*   **T > 0**: Evolução técnica e melhora constante.
*   **T < 0**: Alerta para queda de rendimento ou perda de ritmo.

### Próxima Partida (Forecast)
Projeção matemática (`L + T`) da performance esperada no próximo combate.

### Parâmetros
*   **α (Smoothing Level)**: 0.4
*   **β (Smoothing Trend)**: 0.2
*   **Inicialização**: Média das 3 primeiras partidas do jogador.

---

## 3. Inteligência Tática K.A.I.O.

### Ponto de Foco (Focus Point)
Identifica a principal fonte de impacto da partida baseado nos conselhos gerados pelo motor Python.

### Sinergia Operacional
Mede a coordenação com aliados registrados no Protocolo-V. O sistema identifica membros de squads e valida a performance em grupo.

### FK | FD (First Kills & First Deaths)
*   **FK**: Abates de abertura. Definem a vantagem numérica.
*   **FD**: Mortes de abertura. Indicam falha de posicionamento.

### Violações de Classe
O sistema detecta automaticamente quando métricas-chave ficam abaixo dos mínimos da classe:
*   **KAST abaixo do mínimo** (ex: Controlador < 72%): Gera conselho `VIOLAÇÃO PRIMÁRIA`.
*   **Performance abaixo da meta**: Gera conselho `PERFORMANCE ABAIXO DA META`.

---

## 4. Fluxo de Fila (Queue)

### Ciclo de Vida do Job
1. **Pendente**: Job enfileirado em `match_analysis_queue`.
2. **Processando**: Worker captura o job e inicia a análise.
3. **Concluído**: Job é **removido** da fila. Resultado persiste em `ai_insights`.
4. **Falhado**: Job permanece na fila para retry (máx 3 tentativas com backoff exponencial).

### Backoff Exponencial
*   Tentativa 1: aguarda 5 minutos.
*   Tentativa 2: aguarda 15 minutos.
*   Tentativa 3: aguarda 60 minutos.
*   Após 3 falhas: marcado como permanentemente falhado.

### Limpeza Automática
Jobs falhados com mais de 7 dias são removidos automaticamente da fila.

---

## 5. Identidade e Validação

### Soberania do Proprietário
*   **Dono do Projeto (Telegram)**: `1104821838`
*   **Agente de Validação Principal**: `ousadia#013`

---
*(C) 2026 DEEPMIND ANTIGRAVITY // NÚCLEO_TÁTICO_V4.1*
