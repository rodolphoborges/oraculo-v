# Motor de Inteligência LLM (OpenRouter)

O Oráculo-V v4.0 eleva a barra analítica ao introduzir um motor **Generativo Nativo**, acoplado ao ecossistema assíncrono. Em vez de injetar dezenas de dados crús e arriscar limites de Tokens na infraestrutura de nuvem, desenhamos uma orquestração precisa entre o Math Engine e o OpenRouter.

## 1. O Problema Fundamental: "Token Overflow"

A maioria dos sistemas falha ao tentar mandar o JSON inteiro de uma API (ex: Tracker) direto para a Inteligência Artificial. Isso é caro, ineficiente e disperso (Tokens estouram e a IA "alucina").
O Oráculo **nunca** envia a partida bruta. Ele atua como um Afunilador:

1. A partida roda no Python (`analyze_valorant.py`).
2. O Python decodifica a performance e joga for a o lixo, calculando matemáticas estritas (K/D, ACS, Holt-Winters).
3. Essa matemática já polida se torna a `Prompt Foundation`. A IA não tem a obrigação de calcular nada, apenas agir como *Head Coach* verbalizando os sintomas encontrados pelo Python.

## 2. Visão Temporal (A Mágica da View SQL)

Para que a LLM saiba não apenas da partida de agora, mas do estado sistêmico atual do jogador (Ele está evoluindo? Em decadência?), não mandamos TODAS as últimas dezenas de partidas para a IA.
Em vez disso, utilizamos o próprio Banco de Dados para sumarizar essas "tendências" pesadas, lendo instantaneamente da View:
`vw_player_trends` - Uma view atrelada a nova camada SQL do Oráculo que resume o ACS, KD Range, KAST das últimas 10 partidas numa fração de bytes.

## 3. Resiliência: Arquitetura de Fallback (Free-Tier & NAT)

O código engatilha chamadas API em cadeia via `lib/openrouter_engine.js`. Para não custar $0.01 de infraestrutura, usamos os modelos gratuitos de ponta cedidos pelas provedoras. Se o primeiro falhar por congestionamento (`HTTP 429`), ele tenta o próximo.
1. `meta-llama/llama-3.3-70b-instruct:free` (Primário)
2. `google/gemma-3-12b-it:free` (1° Fallback Nuvem)
3. `qwen/qwen3-4b:free` (2° Fallback Nuvem)

### 3.1 A "Saída de Emergência" (Física/Ollama)
Se a nuvem inteira do OpenRouter colapsar, o sistema conta com uma última linha de defesa: a **Comunicação Direta com o seu Servidor Residencial**.
Se as variáveis `LOCAL_LLM_URL` e `LOCAL_LLM_MODEL` estiverem preenchidas no `.env`, o motor dispara a predição para o seu host local (ex: via NAT/Port-Forwarding na porta `11434` do Ollama). 
*Nota: O parser do Node já é polido para remover as tags XML `<think>` do modelo `deepseek-r1`, garantindo que apenas o conteúdo real seja interpretado como JSON!*

## 4. O Exemplo Prático de Prompt

Abaixo temos um Log gerado diretamente do Worker, mostrando uma chamada real montada e enviada pela máquina para o Perfil "Ousadia#013":

```json
{
    "model": "meta-llama/llama-3.3-70b-instruct:free",
    "messages": [
        {
            "role": "system",
            "content": "Você é um bot JSON estrito."
        },
        {
            "role": "user",
            "content": "Atue como um Head Coach de Valorant Profissional, brutal e analítico.\nVocê receberá dados do motor tático 'Oráculo-V' (Supabase) sobre a partida atual e o histórico do atleta.\n\nDADOS DA PARTIDA: {\"agent\":\"Jett\",\"map\":\"Pearl\",\"perf\":46.2,\"kd\":0.47,\"acs\":167,\"total_rounds\":21,\"conselhosBase\":[\"[K.A.I.O] Agressão punida severamente. Taxa de isolamento comprometedora.\"]}\nTENDÊNCIAS HISTÓRICAS (Últimos 10 jogos): \"Histórico insuficiente\"\nFEEDBACKS PASSADOS RECENTES: Nenhum\n\nDIRETRIZES DE ANÁLISE:\n1. FOCO NO PAPEL: Avalie se a escolha cumpriu a métrica primária esperada (Duelista = Iniciativa/FB, Controlador = Sobrevivência/Trade).\n2. ANÁLISE DE MOMENTUM: Verifique as TENDÊNCIAS HISTÓRICAS.\n3. ECONOMIA E UTILIDADE: Puna verbalmente erros grotescos.\n4. PLANO DE AÇÃO DIRETO: Gere 1 conselho tático e 2 de mecânica.\n\nRESPOSTA OBRIGATÓRIA (Em JSON puro, chaves: 'diagnostico_principal', 'foco_treino', 'tatico', 'nota_coach')."
        }
    ]
}
```

O resultado dessa requisição cai diretamente na base de dados `ai_insights`.
O Worker realiza um espelhamento assíncrono (**Double-Write**) sincronizando os dados simultaneamente com a base do Oráculo (local) e a base do Protocolo-V (Dashboard Front-End).

## 5. Historiador Tático (Backfill Massivo)

Devido ao processamento ser *retroativo* (passar dezenas de partidas que ocorreram antes da v4.0), a documentação prevê o uso focado no motor local (`Ollama` em rede) via `scripts/backfill_history.js`.
O *Backfill* atua mapeando partidas na máquina do oráculo e identificando quais nunca receberam suporte de IA, recarregando assim centenas de relatórios na fila para análise retroativa total.
