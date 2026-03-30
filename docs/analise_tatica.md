# Algoritmos e Regras de Negócio (Motor Python)

Este documento aprofunda as mecânicas de análise do `analyze_valorant.py`, evidenciando a base de cálculo técnico para gerar narrativa ("Lexicon of Impact").

## 1. Performance Index — Cálculo Contextual por Classe (v4.1)

O Oráculo V avalia o desempenho de forma **contextual**, ponderando K/D, ADR e KAST com pesos diferentes por classe de agente:

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

- **100** = desempenho exatamente na meta. Acima = superou, abaixo = ficou aquém.
- O **K/D Alvo** é obtido em tempo real via **vStats.gg**, filtrado por agente, mapa e rank.

### Os Três Níveis Técnicos

| Rank                    | Performance Index | Significado                                   |
|------------------------|-------------------|-----------------------------------------------|
| **Alpha**            | ≥ 115             | Performance excepcional acima da meta          |
| **Omega**            | 95 – 114          | Desempenho consistente dentro do esperado      |
| **Depósito de Torreta** | < 95              | Desempenho abaixo da meta para o contexto      |

### Fonte Única de Verdade (Python)
O motor Python é a **única fonte de avaliação**. O `ImpactAnalyzer.js` foi eliminado na v4.0 para resolver contradições onde métricas e feedback divergiam (ex: K/D 15% abaixo da meta com feedback positivo).

## 2. Holt-Winters Double Exponential Smoothing (Tendências)

Para garantir previsões táticas não oscilatórias caso o jogador faça apenas um round bom (Smurf) ou ruim, nós alimentamos o estado temporal das últimas três partidas usando a variação preditiva:

- Equações base:
  - Nível Absoluto: `L_t = α * y_t + (1 - α) * (L_prev + T_prev)`
  - Medidor de Correção Linear: `T_t = β * (L_t - L_prev) + (1 - β) * T_prev`
  - Predição Próxima: `forecast = L_t + T_t`
- Smoothings constantes do projeto adotados são: Nível = 0.4, Tendência = 0.2. 

Graças a este sistema Matemático, a **Diretriz K.A.I.O.** sabe quando alertar "Estagnação", ou "Declínio" ao invés de cobrar K/D local.

## 3. Heurística e Dicionário de Narrativa "K.A.I.O."

A lógica narrativa do Python utiliza o Módulo `TemplateManager` conectando-se remotamente ou por dicionário nativo aos "Comentários Constitucionais do Protocolo".
Toda vez que uma *Kill* é classificada, o sistema verifica se um colega de time morreu a menos de `5.000` milissegundos antes da finalização. Caso ocorra: `Trade_Positivo`, acionando sintaxes como: "Garantiu a troca cravando com [Arma]".
Se for a primeira kill temporal dentro do JSON, ganha o status Textual de "First Blood".

Seu núcleo também rastreia se existem "Aliados" `(Sinergia)` ou se o Agente detectado pela API corresponde ao da sua classe ótima `(Otimização de Classe)`.

## 4. Evolução: O Prompt Foundation (IA Generativa)

Com a arquitetura LLM nativa introduzida, **o Motor Python deixou de ser o destino final da análise**.
Hoje, toda a base matemática (Aceleradores K/D, Holt-Winters, KAST, Trade-kills) funciona como *Prompt Foundation*. O script Node consolida esses índices puros matemáticos gerados pelo Python e os envia como contexto absoluto ao OpenRouter (Llama/Gemma/Qwen).  
Isso garante que a IA não invente métricas, mas atue puramente como uma analista de comunicação tática em cima de **dados reais e incontestáveis**.
