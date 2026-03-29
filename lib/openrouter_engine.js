/**
 * lib/openrouter_engine.js
 * 
 * Integração OpenRouter (Free Tier) para Oráculo V.
 * Orquestra chamadas LLM com sistema de Fallback Automático (Resiliência)
 * utilizando modelos focados em lógica esportiva e resumos táticos.
 */

import dotenv from 'dotenv';
import { getValidSites, getAgentMission, getFullArsenal, getMapCallouts } from './tactical_knowledge.js';

dotenv.config({ path: '.env', override: true, quiet: true });

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const API_KEY = process.env.OPENROUTER_API_KEY;

// Variáveis de Fallback Local (Configuradas via .env)
const LOCAL_URL = process.env.LOCAL_LLM_URL;
const LOCAL_MODEL = process.env.LOCAL_LLM_MODEL;

// Ordem de preferência de modelos gratuitos no OpenRouter
const FALLBACK_MODELS = [
    'meta-llama/llama-3.3-70b-instruct:free',
    'nvidia/llama-3.3-nemotron-super-49b-v1:free',
    'openrouter/free'
];

const BANNED_TERMS = [
    'menear', 'pratele', 'alinharmos', 'instâncias', 'croixhair', 'punkts', 
    'energia', 'estímulos', 'initiativa', 'group', 'positioning', 'missions', 
    'subpar ', 'util ', 'close', 'playground', 'a1 ', 'incoerência',
    'A Main', 'B Site', 'A Site'
];

// Termos que são PROIBIDOS para agentes específicos (anti-alucinação de kit)
const AGENT_FORBIDDEN_TERMS = {
    "Sage":     ['smoke', 'flash', 'drone', 'flecha', 'explosivo', 'teleporte', 'prowler', 'espreitador'],
    "Cypher":   ['flash', 'cura', 'orbe curativo', 'ressurreição', 'dash', 'updraft'],
    "Killjoy":  ['flash', 'cura', 'orbe curativo', 'ressurreição', 'dash', 'smoke'],
    "Fade":     ['updraft', 'dash', 'brisa de impulso', 'orbe curativo', 'ressurreição', 'smoke', 'incendiário'],
    "Sova":     ['smoke', 'flash', 'cura', 'orbe curativo', 'parede', 'orbe de barreira'],
    "Jett":     ['cura', 'orbe curativo', 'ressurreição', 'prowler', 'drone', 'smoke', 'trap'],
    "Raze":     ['cura', 'orbe curativo', 'ressurreição', 'smoke', 'flash', 'drone', 'trap'],
    "Reyna":    ['smoke', 'drone', 'cura de aliado', 'parede', 'trap', 'prowler'],
    "Brimstone":['flash', 'cura', 'drone', 'trap', 'dash', 'updraft', 'prowler'],
    "Omen":     ['cura', 'drone', 'trap', 'dash', 'updraft', 'prowler', 'orbe curativo'],
    "Viper":    ['flash', 'cura', 'drone', 'dash', 'updraft', 'prowler', 'orbe curativo']
};

/**
 * Filtro de Qualidade: Verifica se a LLM gerou termos proibidos,
 * alucinações táticas, ou habilidades incompatíveis com o agente.
 */
function validateInsightQuality(insight, mapName, agentName) {
    if (!insight || typeof insight !== 'object') return false;
    
    // Check missing keys
    if (!insight.diagnostico_principal || !insight.tatico) {
        console.warn('⚠️ [QUALITY-GUARD] JSON incompleto.');
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
    if (agentName) {
        const agentKey = Object.keys(AGENT_FORBIDDEN_TERMS).find(k => k.toLowerCase() === agentName.toLowerCase());
        if (agentKey) {
            const forbidden = AGENT_FORBIDDEN_TERMS[agentKey];
            const kitViolations = forbidden.filter(term => lower.includes(term.toLowerCase()));
            if (kitViolations.length > 0) {
                console.warn(`⚠️ [QUALITY-GUARD] ALUCINAÇÃO DE KIT: ${agentName} NÃO possui: ${kitViolations.join(', ')}. Recusado.`);
                return false;
            }
        }
    }

    const found = BANNED_TERMS.filter(term => lower.includes(term.toLowerCase()));
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

    const mapName = dados_supabase_match.map || "Desconhecido";
    const agentName = dados_supabase_match.agent || "Combatente";
    const validSites = getValidSites(mapName);
    const agentMission = getAgentMission(agentName);
    const fullArsenal = getFullArsenal();
    const mapCallouts = getMapCallouts(mapName);

    return `Atue como um Head Coach de Valorant Profissional, BRUTAL e ANALÍTICO.
Você receberá dados do motor tático "Oráculo-V" (Supabase) sobre a partida atual e o histórico do atleta.

DADOS DA PARTIDA: ${JSON.stringify(dados_supabase_match)}
HISTÓRICO/TENDÊNCIAS: ${JSON.stringify(tendencias_query)}
FEEDBACKS PASSADOS: ${historico_insights ? JSON.stringify(historico_insights) : 'Nenhum'}${squadText}

--- 
DADOS DE DOMÍNIO OBRIGATÓRIOS:
MAPA: ${mapName} (SITES VÁLIDOS: ${validSites.join(', ')})
CALLOUTS DO MAPA (USE ESTES TERMOS): ${mapCallouts}
AGENTE: ${agentName} (CLASSE: ${agentMission})
ARSENAL DISPONÍVEL: ${fullArsenal}

DIRETRIZES TÁTICAS (NÃO NEGOCIÁVEL):
1. RESPEITE A FUNÇÃO: O jogador está de ${agentName}. A classe dele é **${agentMission.split('[')[0].trim()}**. 
   Ao se referir ao jogador, diga "${agentMission.split('[')[0].trim()}" e NUNCA o chame por outra classe.
   - SENTINELA: Ancorar e segurar avanço. Curar/Parede é COMPLEMENTAR, NUNCA substitui o dever de trocar tiro e causar dano.
   - DUELISTA: Abrir espaço e buscar Entry Frags agressivos.
   - INICIADOR: Usar habilidades de informação ANTES do avanço do time. NÃO é Entry Frag.
   - CONTROLADOR: Cortar linhas de visão com smokes e garantir cobertura. NÃO é Entry Frag.
   REGRA DE OURO: Independente da classe, o jogador DEVE trocar tiro e causar dano. Habilidades são ferramentas táticas, NUNCA substitutos para combate direto.
2. LIMITES DO MAPA: O mapa ${mapName} só tem sites ${validSites.join(' e ')}. É PROIBIDO mencionar site C se o mapa não tiver.
   - USE os callouts BR reais: 'Bomb A', 'Bomb B', 'entrada Long', 'entrada Short' (ou 'rato'). NUNCA use 'A Main', 'A Site', 'B Site'. Fale como um jogador brasileiro.
3. LINGUAGEM CLARA E ACESSÍVEL: Escreva em Português-BR impecável e didático.
   - É PROIBIDO misturar inglês nos textos (ex: 'close alcance', 'util', 'subpar', 'playground'). Use 'curta distância', 'habilidades', 'abaixo da média' e 'área de domínio'.
   - O uso excessivo de gírias obscuras é visto como alucinação. 
   - Nunca use frases vazias como 'Incoerência Tática'. Seja pragmático e mecânico (ex: 'Péssimo controle de spray' ou 'Falta de suporte passivo').
4. NUNCA USE: 'croixhair', 'punkts', 'energia', 'menear', 'instâncias', 'subpar', 'util', 'close', 'A1'.
5. ACRÔNIMOS EDUCATIVOS: Sempre que citar ADR, KAST ou HS%, coloque o significado EXATO entre parênteses. Exemplo: 'ADR (Dano Médio)' ou 'KAST (Participação)'.
6. BLINDAGEM DE HABILIDADES: Recomende APENAS as habilidades exatas que constam na ficha do agente. Sugerir habilidades de outros agentes (ex: Updraft para Fade) resultará em falha crítica.

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

    const mapName = promptData.match_data.map || "Desconhecido";
    const agentName = promptData.match_data.agent || null;

    // 🏠 PRIORIDADE 1: LOCAL (Ollama - Sua máquina)
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
                        { role: 'system', content: 'Você é um assistente tático de Valorant. Responda APENAS em JSON válido.' },
                        { role: 'user', content: sysPrompt }
                    ],
                    temperature: 0.3
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
