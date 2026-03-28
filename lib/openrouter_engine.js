/**
 * lib/openrouter_engine.js
 * 
 * Integração OpenRouter (Free Tier) para Oráculo V.
 * Orquestra chamadas LLM com sistema de Fallback Automático (Resiliência)
 * utilizando modelos focados em lógica esportiva e resumos táticos.
 */

import dotenv from 'dotenv';

dotenv.config({ path: '.env', override: true, quiet: true });

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const API_KEY = process.env.OPENROUTER_API_KEY;

// Ordem de preferência de modelos gratuitos no OpenRouter
const FALLBACK_MODELS = [
    'meta-llama/llama-3.3-70b-instruct:free',
    'google/gemma-3-12b-it:free',
    'qwen/qwen3-4b:free'
];

/**
 * Monta o Prompt "Head Coach Valorant" com base no roteiro oficial.
 */
function buildPrompt(dados_supabase_match, tendencias_query, historico_insights, squad_context) {
    let squadText = "";
    if (squad_context && squad_context.length > 0) {
        squadText = `\nCONTEXTO DO SQUAD (Sinergia): O jogador atuou junto aos aliados: ${squad_context.join(', ')}. Foque em possíveis falhas de trade-kill, suporte cruzado ou falta de timing de entrada no bomb.`;
    }

    return `Atue como um Head Coach de Valorant Profissional, brutal e analítico.
Você receberá dados do motor tático "Oráculo-V" (Supabase) sobre a partida atual e o histórico do atleta.

DADOS DA PARTIDA: ${JSON.stringify(dados_supabase_match)}
TENDÊNCIAS HISTÓRICAS (Últimos 10 jogos): ${JSON.stringify(tendencias_query)}
FEEDBACKS PASSADOS RECENTES: ${historico_insights ? JSON.stringify(historico_insights) : 'Nenhum'}${squadText}

DIRETRIZES DE ANÁLISE:
1. FOCO NO PAPEL: Avalie se o agente escolhido cumpriu a sua métrica primária esperada (Duelista = Iniciativa/FB, Controlador = Sobrevivência/Trade, Iniciador = Assistências/KAST, Sentinela = Retenção).
2. ANÁLISE DE MOMENTUM: Verifique as TENDÊNCIAS HISTÓRICAS. O jogador está numa "Win Streak" e no pique, ou em "Lose Streak" (Consistência vs Posicionamento)? Não repita feedbacks passados.
3. ECONOMIA E UTILIDADE: Puna verbalmente erros grotescos (como morrer sem impacto em rodadas forçadas).
4. PLANO DE AÇÃO DIRETO: Gere 1 conselho tático (diretriz de mapa/posicionamento) e 2 pequenas dicas cirúrgicas de mecânica.

RESPOSTA OBRIGATÓRIA (Cumpra estritamente o formato JSON e sem uso de crases ou \`\`\` para envolver a string. Apenas o objeto puro):
{
    "diagnostico_principal": "Texto curto brutal",
    "foco_treino": ["Dica 1", "Dica 2"],
    "tatico": "Conselho tático no mapa",
    "nota_coach": "0 a 10"
}`;
}

/**
 * Dispara o prompt contra a OpenRouter rotacionando modelos em falha.
 * @param {Object} promptData - Objeto contendo os contextos brutos (match_data, history, trend)
 */
export async function generateInsights(promptData) {
    if (!API_KEY) {
        console.warn('⚠️ [OPENROUTER] API Key não configurada. Ignorando geração LLM.');
        return null; // Graceful degradation
    }

    const sysPrompt = buildPrompt(
        promptData.match_data,
        promptData.trend,
        promptData.history || null,
        promptData.squad || []
    );

    for (let i = 0; i < FALLBACK_MODELS.length; i++) {
        const model = FALLBACK_MODELS[i];
        console.log(`🧠 [LLM] Tentando OpenRouter com modelo: ${model}`);

        try {
            const resp = await fetch(OPENROUTER_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://github.com/rodolphoborges/oraculo-v',
                    'X-Title': 'Oraculo-V Intelligence Engine'
                },
                body: JSON.stringify({
                    model: model,
                    response_format: { type: 'json_object' },
                    messages: [
                        { role: 'system', content: 'Você é um bot JSON estrito.' },
                        { role: 'user', content: sysPrompt }
                    ],
                    temperature: 0.4
                })
            });

            if (!resp.ok) {
                const errText = await resp.text();
                console.warn(`[OPENROUTER] Modelo ${model} falhou com HTTP ${resp.status}: ${errText}`);
                continue; // Tenta o fallback
            }

            const json = await resp.json();
            
            if (json.choices && json.choices.length > 0) {
                const textOutput = json.choices[0].message.content;
                let parsed;
                try {
                    parsed = JSON.parse(textOutput);
                } catch (parseErr) {
                    console.warn(`[OPENROUTER] Resp model ${model} não era JSON válido. Culpado:`, textOutput);
                    continue;
                }

                console.log('✅ [OPENROUTER] Insight gerado com Sucesso!');
                return {
                    insight: parsed,
                    model_used: model
                };
            }
        } catch (err) {
            console.error(`[OPENROUTER] Erro de rede com modelo ${model}: ${err.message}`);
            // Recua para o próximo loop
        }
    }

    console.error('❌ [OPENROUTER] Falha completa do Motor. Nenhum modelo respondeu.');
    return null;
}
