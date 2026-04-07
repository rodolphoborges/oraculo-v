# Algoritmos e Regras de Negocio (Motor JS Nativo)

Este documento aprofunda as mecanicas de analise do `lib/analyze_valorant.js`, evidenciando a base de calculo tecnico para gerar narrativa tatica.

> **Historico**: Ate a v4.1, este motor era implementado em Python (`analyze_valorant.py`). A partir da v5.0, todo o calculo foi migrado para JavaScript nativo em `lib/analyze_valorant.js`.

## 1. Performance Index — Calculo Contextual por Classe (v4.2)

O Oraculo V avalia o desempenho de forma **contextual**, ponderando K/D, ADR e KAST com pesos diferentes por classe de agente:

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

> **Nota de versao**: A v4.1 usava pesos diferentes (Duelista 40/40/20, Iniciador 35/35/30, Controlador 30/30/40, Sentinela 30/30/40). Os pesos acima (v4.2) sao os atualmente implementados no codigo.

- **100** = desempenho exatamente na meta. Acima = superou, abaixo = ficou aquem.
- O **K/D Alvo** e obtido em tempo real via **vStats.gg**, filtrado por agente, mapa e rank.

### Os Tres Niveis Tecnicos

| Rank                    | Performance Index | Significado                                   |
|------------------------|-------------------|-----------------------------------------------|
| **Alpha**            | >= 115             | Performance excepcional acima da meta          |
| **Omega**            | 95 - 114          | Desempenho consistente dentro do esperado      |
| **Deposito de Torreta** | < 95              | Desempenho abaixo da meta para o contexto      |

### Fonte Unica de Verdade (Motor JS)
O motor JavaScript nativo (`lib/analyze_valorant.js`) e a **unica fonte de avaliacao**. O antigo motor Python e o `ImpactAnalyzer.js` foram eliminados para resolver contradicoes onde metricas e feedback divergiam.

## 2. Holt-Winters Double Exponential Smoothing (Tendencias)

Para garantir previsoes taticas nao oscilatorias, o sistema alimenta o estado temporal das ultimas partidas usando a variacao preditiva:

- Equacoes base:
  - Nivel Absoluto: `L_t = alpha * y_t + (1 - alpha) * (L_prev + T_prev)`
  - Medidor de Correcao Linear: `T_t = beta * (L_t - L_prev) + (1 - beta) * T_prev`
  - Predicao Proxima: `forecast = L_t + T_t`
- Smoothings constantes: Nivel (alpha) = 0.4, Tendencia (beta) = 0.2.

Gracas a este sistema, a **Diretriz K.A.I.O.** sabe quando alertar "Estagnacao" ou "Declinio" ao inves de cobrar K/D local.

## 3. Heuristica e Dicionario de Narrativa "K.A.I.O."

A logica narrativa do motor JS utiliza a base tatica (`lib/tactical_knowledge.js`) contendo:
- Arsenal oficial completo (incluindo Outlaw)
- Todos os mapas com listagem rigida de Sites validos
- Todos os agentes com roles e habilidades
- Obrigacoes por role e missao especifica do agente

Toda vez que uma kill e classificada, o sistema verifica se um colega de time morreu a menos de 5.000 milissegundos antes da finalizacao. Caso ocorra: `Trade_Positivo`. Se for a primeira kill temporal dentro do JSON, ganha o status de "First Blood".

## 4. Evolucao: Tribunal Engine (IA Generativa Adversarial)

Com a arquitetura Tribunal Engine introduzida na v5.1, **o motor JS gera os dados matematicos puros** que servem como "Prompt Foundation" para as 3 personas do Tribunal:

1. **Perspectiva Aliada**: Recebe os dados + contexto do time aliado
2. **Perspectiva Rival**: Recebe os dados + contexto do time inimigo
3. **Mentor K.A.I.O.**: Sintetiza ambas as visoes no conselho final

Isso garante que a IA nao invente metricas, mas atue puramente como analista de comunicacao tatica em cima de **dados reais e incontestaveis** gerados pelo motor JS.
