# Oráculo V | Regras de Negócio e Domínio Tático

Este documento detalha o funcionamento interno do motor de análise do **Oráculo V**, explicando como as estatísticas brutas do Valorant são transformadas em inteligência tática interpretável.

---

## 1. Métricas de Impacto

### Índice de Performance (IK)
O **IK** é o "Score de Elite" do Protocolo V. Diferente de um K/D simples, ele mede o impacto real do jogador no servidor.
*   **Cálculo**: `(K/D_Relativo * 0.4) + (ADR_Relativo * 0.6) * 100`
*   **Filosofia**: O **ADR (Dano Médio por Round)** tem 60% de peso. No Protocolo V, a capacidade de gerar pressão e punir o time adversário com dano é considerada mais valiosa do que apenas garantir o "last hit".
*   **Base**: 100 é a média estatística. Valores acima de 115 são considerados "Elite do Protocolo".

### Status Mira
Avaliação qualitativa do combate técnico. 
*   **Composição**: Baseia-se na taxa de HS (Headshots), tempo de reação médio (extraído dos timestamps de kill) e consistência em duelos de desvantagem.
*   **Feedback**: Gera narrativas como "Aula de mira" (alta precisão) ou "Pinou feio" (baixa eficácia de dano por disparo).

---

## 2. Modelo Preditivo (Holt-Winters)

O Oráculo V utiliza o algoritmo **Double Exponential Smoothing (Holt-Winters)** para analisar a evolução do jogador ao longo do tempo.

### Nível Atual (Level - L)
Representa a base técnica estável do jogador. Ele "limpa" o ruído de partidas atípicas (sorte ou azar), mostrando qual o nível real de entrega do agente no longo prazo.

### Tendência (Trend - T)
Mede a aceleração da performance. 
*   **T > 0**: Indica evolução técnica e melhora constante.
*   **T < 0**: Alerta para queda de rendimento ou perda de ritmo.

### Próxima Partida (Forecast)
Uma projeção matemática (`L + T`) de quanto o Oráculo espera que o jogador performe no próximo combate. Útil para prever *burnouts* ou picos de performance.

---

## 3. Inteligência Tática K.A.I.O.

### Ponto de Foco (Focus Point)
Identifica a principal fonte de impacto da partida.
*   Ex: **"DANO BRUTO"** (Impacto via ADR massivo), **"ABERTURA DE SETOR"** (Impacto via First Bloods), **"RESILIÊNCIA"** (Impacto via sobrevivência e trades).

### Sinergia Operacional
Mede a coordenação com aliados conhecidos. O sistema identifica membros de squads registrados e valida se a performance em grupo é superior à performance solo.

### FK | FD (First Kills & First Deaths)
*   **FK**: Abates de abertura. Definem a vantagem numérica.
*   **FD**: Mortes de abertura. Indicam falha de posicionamento ou agressividade punida.
*   **Ausência (-- | 0)**: Quando um jogador tem 0/0 em aberturas, indica que ele atuou em funções de suporte ou finalização, não participando do contato inicial do round.

---

## 4. Identidade e Validação MVP

### Soberania do Proprietário
Para fins de validação do MVP e lançamento do Bot de Telegram, o foco total de testes e integração deve ser o proprietário do projeto.
*   **Dono do Projeto (Telegram)**: `1104821838`
*   **Agente de Validação Principal**: `ousadia#013`

### Regras MVP
1. **Prioridade de Notificação**: O bot de Telegram deve ser validado integralmente usando o usuário `ousadia#013`.
2. **Associação de Contas**: A associação Telegram <-> Instagram/Riot ID está confirmada para este usuário.
3. **Ambiente de Teste**: Qualquer lógica de "Broadcast" ou notificações automáticas deve ser ativada primariamente para este ID durante a fase 1.

---
*(C) 2026 DEEPMIND ANTIGRAVITY // NÚCLEO_TÁTICO_V4*
