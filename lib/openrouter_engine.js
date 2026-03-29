/**
 * lib/openrouter_engine.js
 * 
 * Integração OpenRouter (Free Tier) para Oráculo V.
 * Orquestra chamadas LLM com sistema de Fallback Automático (Resiliência)
 * utilizando modelos focados em lógica esportiva e resumos táticos.
 */

import dotenv from 'dotenv';
import { getValidSites, getAgentMission, getFullArsenal, getMapCallouts, AGENT_KNOWLEDGE } from './tactical_knowledge.js';

dotenv.config({ path: '.env', override: true, quiet: true });

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const API_KEY = process.env.OPENROUTER_API_KEY;

// Variáveis de Fallback Local (Configuradas via .env)
const LOCAL_URL = process.env.LOCAL_LLM_URL;
const LOCAL_MODEL = process.env.LOCAL_LLM_MODEL;

// Ordem de preferência de modelos gratuitos no OpenRouter
const FALLBACK_MODELS = [
    'qwen/qwen3-coder:free',
    'qwen/qwen3-next-80b-a3b-instruct:free',
    'openai/gpt-oss-120b:free',
    'stepfun/step-3.5-flash:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
    'minimax/minimax-m2.5:free',
    'openrouter/free'
];

const BANNED_TERMS = [
    'menear', 'pratele', 'alinharmos', 'instâncias', 'croixhair', 'punkts', 
    'energia', 'estímulos', 'initiativa', 'group', 'positioning', 'missions', 
    'incoerência', 'iteração', 'validação', 'métrica', 'feedback', 
    'alavancagem', 'otimização', 'parametrização', 'fluxo', 'proposta', 'dinâmica'
];

// Termos que são PROIBIDOS para agentes específicos (anti-alucinação de kit)
const AGENT_FORBIDDEN_TERMS = {
    "Sage":     ['smoke', 'flash', 'drone', 'flecha', 'explosivo', 'teleporte', 'prowler', 'espreitador'],
    "Cypher":   ['flash', 'cura', 'orbe curativo', 'ressurreição', 'dash', 'updraft'],
    "Killjoy":  ['flash', 'cura', 'orbe curativo', 'ressurreição', 'dash', 'smoke'],
    "Fade":     ['updraft', 'dash', 'brisa de impulso', 'orbe curativo', 'ressurreição', 'smoke', 'incendiário'],
    "Sova":     ['smoke', 'flash', 'cura', 'orbe curativo', 'parede', 'orbe de barreira'],
    "Jett":     ['cura', 'orbe curativo', 'ressurreição', 'prowler', 'drone', 'trap'],
    "Raze":     ['cura', 'orbe curativo', 'ressurreição', 'smoke', 'flash', 'drone', 'trap'],
    "Reyna":    ['smoke', 'drone', 'cura de aliado', 'parede', 'trap', 'prowler'],
    "Brimstone":['flash', 'cura', 'drone', 'trap', 'dash', 'updraft', 'prowler'],
    "Omen":     ['cura', 'drone', 'trap', 'dash', 'updraft', 'prowler', 'orbe curativo'],
    "Viper":    ['flash', 'cura', 'drone', 'dash', 'updraft', 'prowler', 'orbe curativo'],
    // NOVOS MAPEMANTOS EXAUSTIVOS
    "Phoenix":  ['smoke', 'drone', 'trap', 'dash', 'updraft', 'prowler', 'teleporte'],
    "Yoru":     ['smoke', 'drone', 'trap', 'cura', 'dash', 'updraft'],
    "Neon":     ['smoke', 'drone', 'trap', 'cura', 'teleporte', 'prowler'],
    "Iso":      ['smoke', 'drone', 'trap', 'cura', 'dash', 'updraft', 'teleporte'],
    "Waylay":   ['smoke', 'flash', 'cura', 'drone', 'dash', 'updraft'],
    "Chamber":  ['smoke', 'flash', 'cura', 'dash', 'updraft', 'prowler', 'recon'],
    "Deadlock": ['smoke', 'flash', 'cura', 'dash', 'updraft', 'teleporte', 'recon'],
    "Vyse":     ['smoke', 'drone', 'cura', 'dash', 'updraft', 'teleporte', 'recon'],
    "Veto":      ['smoke', 'flash', 'cura', 'dash', 'updraft', 'teleporte', 'drone', 'trap'],
    "Breach":   ['smoke', 'drone', 'cura', 'dash', 'updraft', 'teleporte', 'trap', 'recon'],
    "Skye":     ['smoke', 'parede', 'dash', 'updraft', 'teleporte', 'trap'],
    "KAY/O":    ['smoke', 'drone', 'cura', 'dash', 'updraft', 'teleporte', 'trap', 'parede'],
    "Gekko":    ['smoke', 'parede', 'cura', 'dash', 'updraft', 'teleporte'],
    "Tejo":     ['smoke', 'flash', 'cura', 'dash', 'updraft', 'teleporte', 'trap'],
    "Astra":    ['flash', 'cura', 'dash', 'updraft', 'teleporte', 'drone', 'trap'],
    "Harbor":   ['flash', 'cura', 'dash', 'updraft', 'teleporte', 'drone', 'trap'],
    "Clove":    ['flash', 'drone', 'trap', 'teleporte', 'recon', 'updraft'],
    "Miks":     ['flash', 'cura', 'dash', 'updraft', 'teleporte', 'drone', 'trap', 'recon']
};

/**
 * Filtro de Qualidade: Verifica se a LLM gerou termos proibidos,
 * alucinações táticas, ou habilidades incompatíveis com o agente.
 */
export function validateInsightQuality(insight, mapName, agentName) {
    if (!insight || typeof insight !== 'object') return false;
    
    // Check missing keys
    if (!insight.diagnostico_principal || !insight.tatico) {
        console.warn(`⚠️ [QUALITY-GUARD] JSON incompleto. Faltando diagnostic ou tatico.`);
        return false;
    }
    if (!insight.foco_treino || !Array.isArray(insight.foco_treino)) {
        console.warn(`⚠️ [QUALITY-GUARD] JSON incompleto. Faltando foco_treino.`);
        return false;
    }

    const text = JSON.stringify(insight);
    
    // Check for non-Latin characters (indicator of severe hallucination)
    if (/[^\x00-\x7F\u00C0-\u017F\s.,!?:;"'()\[\]\n\r]/.test(text)) {
        console.warn('⚠️ [QUALITY-GUARD] Alucinação detectada (caracteres estranhos/não-latinos).');
        return false;
    }

    const lower = text.toLowerCase();

    // VALIDAÇÃO DE SITES (Não sugerir Site C em mapas de 2 sites)
    const validSites = getValidSites(mapName);
    if (validSites.length === 2) {
        if (lower.includes('site c') || lower.includes('rota c') || lower.includes('bomb c')) {
            console.warn(`⚠️ [QUALITY-GUARD] ALUCINAÇÃO DE MAPA: Mencionado Site C no mapa ${mapName}. Recusado.`);
            return false;
        }
    }

    // VALIDAÇÃO DE HABILIDADES CRUZADAS (Anti-Alucinação de Kit)
    // 1. Verificação de Termos Proibidos (Vago/Corporativo)
    for (const term of BANNED_TERMS) {
        if (lower.includes(term.toLowerCase())) {
            console.warn(`❌ [QUALITY] Rejeitado: Termo proibido '${term}' detectado.`);
            return false;
        }
    }

    // 2. Verificação de Alucinação de Habilidades (Agent Ground Truth)
    if (agentName) {
        const agentKey = Object.keys(AGENT_FORBIDDEN_TERMS).find(k => k.toLowerCase() === agentName.toLowerCase());
        if (agentKey) {
            const forbidden = AGENT_FORBIDDEN_TERMS[agentKey];
            const kitViolations = forbidden.filter(term => lower.includes(term.toLowerCase()));
            if (kitViolations.length > 0) {
                console.warn(`❌ [QUALITY] Rejeitado: Alucinação detectada (Agente ${agentName} não possui '${kitViolations.join(', ')}').`);
                return false;
            }
        }
    }

    return true;
}

/**
 * Monta o Prompt com base no Impacto e Conhecimento de Agentes.
 */
function buildPrompt(dados_supabase_match, tendencias_query, historico_insights, squad_context) {
    let squadText = "";
    if (squad_context && squad_context.length > 0) {
        squadText = `\nCONTEXTO DO SQUAD (Sinergia): O jogador atuou junto aos aliados: ${squad_context.join(', ')}. Foque em possíveis falhas de trade-kill, suporte cruzado ou falta de timing de entrada no bomb.`;
    }

    const mapName = dados_supabase_match.map || "Desconhecido";
    const agentName = dados_supabase_match.agent || "Combatente";
    const impactScore = dados_supabase_match.perf || 0;
    const impactRank = dados_supabase_match.rank || "Unknown";
    const adr = dados_supabase_match.adr || 0;
    
    // Identificação Dinâmica: Busca Keywords no AGENT_KNOWLEDGE
    let keywords = [];
    for (const role in AGENT_KNOWLEDGE) {
        if (AGENT_KNOWLEDGE[role][agentName]) {
            keywords = AGENT_KNOWLEDGE[role][agentName];
            break;
        }
    }
    const keywordsText = keywords.length > 0 ? keywords.join(', ') : "Kit de Elite";

    // Substituição Dinâmica de Variáveis no Tom
    let tone = dados_supabase_match.tone_instruction || "";
    tone = tone.replace(/\[Agente\]/g, agentName);
    tone = tone.replace(/\[Keywords\]/g, keywordsText);

    const validSites = getValidSites(mapName);
    const agentMission = getAgentMission(agentName);
    const fullArsenal = getFullArsenal();
    const mapCallouts = getMapCallouts(mapName);

    return `Atue como um Head Coach de Valorant Profissional e Especialista em IA.

--- MÉTRICAS TÉCNICAS (BASE FACTUAL) ---
RESULTADO: Score de Impacto: ${impactScore} | Rank: ${impactRank} | ADR: ${adr} (Dano Médio) | KD: ${dados_supabase_match.kd}
AGENTE: ${agentName} (${agentMission}) | MAPA: ${mapName}
KEYWORDS DO KIT: ${keywordsText}

--- DIRETRIZES DE NARRATIVA ---
INSTRUÇÃO DE TOM: ${tone}

DIRETRIZES TÁTICAS (Obrigatórias):
1. Use Português-BR impecável e tom profissional (ou agressivo, conforme o tom acima).
2. Se rank for Depósito de Torreta, sua análise deve ser sarcástica e desencorajadora, mencionando nominalmente as falhas de [Keywords].
3. Se rank for Alpha, elogie a dominância e a leitura de jogo superior.
4. NUNCA use termos corporativos (métrica, validação, iteração, alavancagem).
5. NUNCA use inglês desnecessário (subpar, feedback, dynamics, missions).

HISTÓRICO: ${historico_insights ? JSON.stringify(historico_insights) : 'Nenhum'}${squadText}

RESPOSTA OBRIGATÓRIA (Formato JSON puro):
{
    "diagnostico_principal": "Texto curto impactante para o site Protocolo-V",
    "foco_treino": ["Dica mecânica real baseada nos números", "Dica tática baseada no kit"],
    "tatico": "Foco de posicionamento no mapa ${mapName}",
    "nota_coach": "0.0 a 10.0 (Baseada no Score ${impactScore})"
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

    const mapName = promptData.match_data.map || "Desconhecido";
    const agentName = promptData.match_data.agent || null;

    // 🏠 PRIORIDADE 1: LOCAL (Ollama - Sua máquina)
    if (LOCAL_URL && LOCAL_MODEL) {
        console.log(`🏠 [LLM-LOCAL] Tentando local: ${LOCAL_MODEL}`);
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s

            const resp = await fetch(`${LOCAL_URL}/v1/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    model: LOCAL_MODEL,
                    response_format: { type: 'json_object' },
                    messages: [
                        { role: 'system', content: 'Você é um assistente tático de Valorant. Responda APENAS em JSON válido.' },
                        { role: 'user', content: sysPrompt }
                    ],
                    temperature: 0.3
                })
            });
            clearTimeout(timeoutId);

            if (resp.ok) {
                const json = await resp.json();
                if (json.choices && json.choices.length > 0) {
                    let textOutput = json.choices[0].message.content;
                    // Limpeza Profunda: Remove tags <think>...</think> ou qualquer outro lixo de reasoning
                    textOutput = textOutput.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
                    
                    // Garante que pegamos apenas o objeto JSON ({ ... })
                    const braceIdx = textOutput.indexOf('{');
                    if (braceIdx > -1) {
                        const lastBraceIdx = textOutput.lastIndexOf('}');
                        if (lastBraceIdx > braceIdx) {
                            textOutput = textOutput.substring(braceIdx, lastBraceIdx + 1);
                        } else {
                            textOutput = textOutput.substring(braceIdx);
                        }
                    }

                    try {
                        const parsed = JSON.parse(textOutput);
                        if (validateInsightQuality(parsed, mapName, agentName)) {
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

    // 🧠 PRIORIDADE 2: OpenRouter (Fallback quando Ollama está indisponível)
    if (API_KEY) {
        for (let i = 0; i < FALLBACK_MODELS.length; i++) {
            const model = FALLBACK_MODELS[i];
            console.log(`🧠 [LLM-ELITE] Tentando OpenRouter: ${model}`);

            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 30000);

                const resp = await fetch(OPENROUTER_URL, {
                    method: 'POST',
                    signal: controller.signal,
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

                clearTimeout(timeout);

                if (resp.ok) {
                    const json = await resp.json();
                    if (json.choices && json.choices.length > 0) {
                        const textOutput = json.choices[0].message.content;
                        try {
                            const parsed = JSON.parse(textOutput);
                            if (validateInsightQuality(parsed, mapName, agentName)) {
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
