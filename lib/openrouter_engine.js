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

// Variáveis de Fallback Local (Configuradas via .env)
const LOCAL_URL = process.env.LOCAL_LLM_URL;
const LOCAL_MODEL = process.env.LOCAL_LLM_MODEL;

// Ordem de preferência de modelos gratuitos no OpenRouter
const FALLBACK_MODELS = [
    'meta-llama/llama-3.3-70b-instruct:free',
    'google/gemma-3-12b-it:free',
    'qwen/qwen3-4b:free'
];

const BANNED_TERMS = ['menear', 'pratele', 'alinharmos', 'instâncias', 'croixhair', 'punkts', 'energia', 'estímulos', 'initiativa', 'group', 'positioning', 'missions'];

/**
 * Filtro de Qualidade: Verifica se a LLM gerou termos proibidos ou traduções quebradas.
 */
function validateInsightQuality(insight) {
    if (!insight || typeof insight !== 'object') return false;
    
    // Check missing keys
    if (!insight.diagnostico_principal || !insight.tatico) {
        console.warn('⚠️ [QUALITY-GUARD] JSON incompleto.');
        return false;
    }

    const text = JSON.stringify(insight);
    
    // Check for non-Latin characters (indicator of severe hallucination like Chinese chars)
    // We allow basic Latin-1 (including Portuguese accents)
    if (/[^\x00-\x7F\u00C0-\u017F\s.,!?:;"'()\[\]\n\r]/.test(text)) {
        console.warn('⚠️ [QUALITY-GUARD] Alucinação detectada (caracteres estranhos/não-latinos).');
        return false;
    }

    const lower = text.toLowerCase();
    const found = BANNED_TERMS.filter(term => lower.includes(term));
    if (found.length > 0) {
        console.warn(`⚠️ [QUALITY-GUARD] Termos Proibidos Detectados: ${found.join(', ')}`);
        return false;
    }
    return true;
}

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

DIRETRIZES DE ESTILO E LINGUAGEM (OBRIGATÓRIO):
1. USE VOCABULÁRIO DE FPS/VALORANT: 'Entry frag', 'Trade/re-frag', 'Lurker', 'IGL', 'Rotate/Rotacionar', 'Crosshair placement', 'Econ/Eco round', 'Full Buy', 'Save', 'Utilities', 'Bomb site', 'Peak/Wide peak', 'Hold/Segurar'.
2. NUNCA USE ESTES TERMOS (TRADUÇÕES ERRADAS): 'croixhair', 'punkts', 'energia', 'altos estímulos', 'menear', 'preservar a time', 'precisão nas assists', 'Pratele', 'alinharmos', 'instâncias'. Use termos de jogo reais.
3. EXEMPLO DE TOM DE VOZ:
   - RUIM: "Sua precisão nas assists foi baixa e você deve menear o group."
   - BOM: "Seu KAST está abaixo do ideal. Você está morrendo sem ser trocado e falhando no re-frag. Melhore seu crosshair placement e rotacione mais rápido para o site quando o IGL der o call."
4. FOCO NO PAPEL: Avalie se o agente escolhido cumpriu a sua missão (Duelista = FB, Controlador = Smoke/Trade, Iniciador = Assist/KAST, Sentinela = Lock/Antiflank).
5. ECONOMIA/UTILIDADE: Puna verbalmente erros de economia ou utilities desperdiçadas.

RESPOSTA OBRIGATÓRIA (Formato JSON puro):
{
    "diagnostico_principal": "Texto curto brutal com termos técnicos REAIS de Valorant",
    "foco_treino": ["Dica técnica específica 1", "Dica técnica específica 2"],
    "tatico": "Conselho tático de posicionamento para o mapa",
    "nota_coach": "0 a 10"
}`;
}

/**
 * Dispara o prompt contra a OpenRouter rotacionando modelos em falha.
 * @param {Object} promptData - Objeto contendo os contextos brutos (match_data, history, trend)
 */
export async function generateInsights(promptData) {
    const sysPrompt = buildPrompt(
        promptData.match_data,
        promptData.trend,
        promptData.history || null,
        promptData.squad || []
    );

    // 🚀 PRIORIDADE 1: FALLBACK LOCAL (Resiliência e Desempenho)
    if (LOCAL_URL && LOCAL_MODEL) {
        console.log(`🏠 [LLM-LOCAL] Tentando local: ${LOCAL_MODEL}`);
        try {
            const resp = await fetch(`${LOCAL_URL}/v1/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: LOCAL_MODEL,
                    response_format: { type: 'json_object' },
                    messages: [
                        { role: 'system', content: 'Você é um assistente tático de Valorant.' },
                        { role: 'user', content: sysPrompt }
                    ],
                    temperature: 0.4
                })
            });

            if (resp.ok) {
                const json = await resp.json();
                if (json.choices && json.choices.length > 0) {
                    let textOutput = json.choices[0].message.content;
                    if (textOutput.includes('</think>')) {
                        textOutput = textOutput.split('</think>')[1].trim();
                    } else {
                        const braceIdx = textOutput.indexOf('{');
                        if (braceIdx > -1) textOutput = textOutput.substring(braceIdx);
                    }

                    try {
                        const parsed = JSON.parse(textOutput);
                        if (validateInsightQuality(parsed)) {
                            console.log('✅ [LLM-LOCAL] Insight aprovado.');
                            return { insight: parsed, model_used: `local-${LOCAL_MODEL}` };
                        } else {
                            console.warn('⚠️ [LLM-LOCAL] Recusado no filtro de qualidade.');
                        }
                    } catch (err) {
                        console.warn('[LLM-LOCAL] Falha parse ou qualidade.', textOutput);
                    }
                }
            }
        } catch (e) {
            console.error(`❌ [LLM-LOCAL] Offline: ${e.message}`);
        }
    }

    // 🚀 PRIORIDADE 2: OpenRouter (Elite Quality Fallback)
    if (API_KEY) {
        for (let i = 0; i < FALLBACK_MODELS.length; i++) {
            const model = FALLBACK_MODELS[i];
            console.log(`🧠 [LLM-ELITE] Tentando OpenRouter: ${model}`);

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
                            { role: 'system', content: 'Você é um bot de Coach tático de Valorant. Responda em Português de elite.' },
                            { role: 'user', content: sysPrompt }
                        ],
                        temperature: 0.3
                    })
                });

                if (resp.ok) {
                    const json = await resp.json();
                    if (json.choices && json.choices.length > 0) {
                        const textOutput = json.choices[0].message.content;
                        try {
                            const parsed = JSON.parse(textOutput);
                            if (validateInsightQuality(parsed)) {
                                console.log(`✅ [LLM-ELITE] Insight aprovado via OpenRouter (${model})`);
                                return { insight: parsed, model_used: model };
                            }
                        } catch (e) { console.warn(`[OPENROUTER] Erro parse: ${e.message}`); }
                    }
                } else {
                    const err = await resp.text();
                    console.warn(`[OPENROUTER] Modelo ${model} falhou (${resp.status}): ${err}`);
                }
            } catch (err) {
                console.error(`[OPENROUTER] Falha com ${model}: ${err.message}`);
            }
        }
    }

    console.error('❌ [CRÍTICO] Falha total da Inteligência.');
    return null;
}
