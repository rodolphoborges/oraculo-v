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
    if (!insight) return false;
    const text = JSON.stringify(insight).toLowerCase();
    const found = BANNED_TERMS.filter(term => text.includes(term));
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

    // 🚀 PRIORIDADE 1: LLM LOCAL (Ollama/NAT)
    if (LOCAL_URL && LOCAL_MODEL) {
        console.log(`🏠 [LLM-LOCAL] Acionando Prioridade Física com: ${LOCAL_MODEL} em ${LOCAL_URL}`);
        try {
            const resp = await fetch(`${LOCAL_URL}/v1/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: LOCAL_MODEL,
                    response_format: { type: 'json_object' },
                    messages: [
                        { role: 'system', content: 'Você é um assistente que responde APENAS em JSON, sem blocos de texto adicionais.' },
                        { role: 'user', content: sysPrompt }
                    ],
                    temperature: 0.4
                })
            });

            if (resp.ok) {
                const json = await resp.json();
                if (json.choices && json.choices.length > 0) {
                    let textOutput = json.choices[0].message.content;
                    
                    // Tratamento seguro para DeepSeek-R1 (Filtra a tag <think>)
                    if (textOutput.includes('</think>')) {
                        textOutput = textOutput.split('</think>')[1].trim();
                    } else {
                        // Limpa lixos antes do primeiro '{'
                        const braceIdx = textOutput.indexOf('{');
                        if (braceIdx > -1) textOutput = textOutput.substring(braceIdx);
                    }

                    try {
                        const parsed = JSON.parse(textOutput);
                        
                        // Validação de Elite
                        if (validateInsightQuality(parsed)) {
                            console.log('✅ [LLM-LOCAL] Insight de Qualidade Gerado.');
                            return { insight: parsed, model_used: `local-${LOCAL_MODEL}` };
                        } else {
                            console.warn('⚠️ [LLM-LOCAL] Recusado pelo Controle de Qualidade (Filtro Tático). Tentando OpenRouter...');
                        }
                    } catch (err) {
                        console.warn('[LLM-LOCAL] Falha ao processar JSON. Tentando Fallback OpenRouter...', textOutput);
                    }
                }
            } else {
                console.warn(`[LLM-LOCAL] Ollama falhou com HTTP ${resp.status}. Pulando para OpenRouter...`);
            }
        } catch (e) {
            console.error(`❌ [LLM-LOCAL] Falha de conexão: ${e.message}. Pulando para OpenRouter...`);
        }
    }

    // 🚀 PRIORIDADE 2: OpenRouter (Fallback de Resiliência)
    if (!API_KEY) {
        console.warn('⚠️ [OPENROUTER] API Key não configurada e Local Offline. Ignorando geração LLM.');
        return null;
    }

    for (let i = 0; i < FALLBACK_MODELS.length; i++) {
        const model = FALLBACK_MODELS[i];
        console.log(`🧠 [LLM-FALLBACK] Tentando OpenRouter com modelo: ${model}`);

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
                        { role: 'system', content: 'Você é um bot JSON estrito focado em coach de Valorant.' },
                        { role: 'user', content: sysPrompt }
                    ],
                    temperature: 0.4
                })
            });

            if (!resp.ok) {
                const errText = await resp.text();
                console.warn(`[OPENROUTER] Modelo ${model} falhou com HTTP ${resp.status}: ${errText}`);
                continue;
            }

            const json = await resp.json();
            
            if (json.choices && json.choices.length > 0) {
                const textOutput = json.choices[0].message.content;
                let parsed;
                try {
                    parsed = JSON.parse(textOutput);
                } catch (parseErr) {
                    console.warn(`[OPENROUTER] Resp model ${model} não era JSON válido.`, textOutput);
                    continue;
                }

                console.log(`✅ [OPENROUTER] Insight gerado via Fallback ${model}`);
                return {
                    insight: parsed,
                    model_used: model
                };
            }
        } catch (err) {
            console.error(`[OPENROUTER] Erro de rede com modelo ${model}: ${err.message}`);
        }
    }

    console.error('❌ [CRÍTICO] Falha Completa da Inteligência.');
    return null;
}
