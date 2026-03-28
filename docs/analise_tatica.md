# Algoritmos e Regras de Negócio (Motor Python)

Este documento aprofunda as mecânicas de análise do `analyze_valorant.py`, evidenciando a base de cálculo técnico para gerar narrativa ("Lexicon of Impact").

## 1. Índice de Performance Ponderada

Não usamos apenas a taxa de abates pura do jogador. O Oráculo utiliza a equação a seguir calcada na média *Target*:

`Índice de Performance (perf_idx) = (K/D_Real / Target_KD) * 0.4 + (ADR / 135.0) * 0.6`

- **O ADR (Average Damage per Round)** representa 60% do impacto. Entregando a filosofia do Oráculo: *Morte vazia tem peso menor que dano garantido capaz de pressionar espaço térreo*.
- Uma `perf_idx` > 115 aciona a heurística textual **"ELITE DO PROTOCOLO"**.
- Abaixo de 95, ocorre acionamento do conselho K.A.I.O. de alerta.

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
