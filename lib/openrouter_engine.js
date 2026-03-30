/**
 * lib/openrouter_engine.js
 *
 * Motor de IA do Oráculo V — Cadeia de Resiliência em 3 Níveis:
 *   1. 🏠 LOCAL  — Ollama na máquina do usuário (qwen3:8b por padrão)
 *   2. 🆓 GROQ   — Free tier com llama-3.3-70b (cadastro gratuito)
 *   3. 🧠 OPENROUTER — Modelos gratuitos como fallback final
 */

import dotenv from 'dotenv';
import { getValidSites, getAgentMission, getFullArsenal, getMapCallouts, AGENT_KNOWLEDGE, getRoleObligations } from './tactical_knowledge.js';
import { getAgentAbilitiesFromAPI } from './valorant_api.js';

dotenv.config({ path: '.env', override: true, quiet: true });

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const API_KEY = process.env.OPENROUTER_API_KEY;

// Groq — Free tier (https://console.groq.com)
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
// Ordem de preferência Groq: começa com o maior modelo gratuito disponível
const GROQ_MODELS = [
    'llama-3.3-70b-versatile',       // 70B — melhor qualidade, limite generoso
    'meta-llama/llama-4-scout-17b-16e-instruct', // 17B — alternativa rápida
    'gemma2-9b-it',                  // 9B — fallback leve
];

// Local (Ollama)
const LOCAL_URL = process.env.LOCAL_LLM_URL;
const LOCAL_MODEL = process.env.LOCAL_LLM_MODEL;

// OpenRouter — fallback final (modelos gratuitos)
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
    if (!insight.diagnostico_principal || !insight.pontos_fortes || !insight.pontos_fracos) {
        console.warn(`⚠️ [QUALITY-GUARD] JSON incompleto. Faltando campos obrigatórios.`);
        return false;
    }
    if (!Array.isArray(insight.pontos_fortes) || !Array.isArray(insight.pontos_fracos)) {
        console.warn(`⚠️ [QUALITY-GUARD] Campos de lista devem ser Arrays.`);
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
 * Monta o Prompt com base no Impacto, Role e Conhecimento de Agentes.
 * Assíncrono para buscar habilidades da valorant-api.com em PT-BR.
 */
async function buildPrompt(dados_supabase_match, tendencias_query, historico_insights, squad_context) {
    let squadText = "";
    if (squad_context && squad_context.length > 0) {
        squadText = `\nCONTEXTO DO SQUAD (Sinergia): O jogador atuou junto aos aliados: ${squad_context.join(', ')}. Foque em possíveis falhas de trade-kill, suporte cruzado ou falta de timing de entrada no bomb.`;
    }

    const mapName = dados_supabase_match.map || "Desconhecido";
    const agentName = dados_supabase_match.agent || "Combatente";
    const playerRole = dados_supabase_match.role || null;
    const impactScore = dados_supabase_match.perf || 0;
    const impactRank = dados_supabase_match.rank || "Unknown";
    const adr = dados_supabase_match.adr || 0;
    const kast = dados_supabase_match.kast || null;
    const firstKills = dados_supabase_match.first_kills ?? null;
    const clutches = dados_supabase_match.clutches ?? null;

    // Keywords estáticas do AGENT_KNOWLEDGE (normalização para KAY/O e similares)
    const normalizeAgentKey = n => n.toLowerCase().replace(/[^a-z0-9]/g, '');
    let keywords = [];
    for (const role in AGENT_KNOWLEDGE) {
        const agentKey = Object.keys(AGENT_KNOWLEDGE[role]).find(
            k => normalizeAgentKey(k) === normalizeAgentKey(agentName)
        );
        if (agentKey) {
            keywords = AGENT_KNOWLEDGE[role][agentKey];
            break;
        }
    }
    const keywordsText = keywords.length > 0 ? keywords.join(', ') : "Kit de Elite";

    // Substituição Dinâmica de Variáveis no Tom
    let tone = dados_supabase_match.tone_instruction || "";
    tone = tone.replace(/\[Agente\]/g, agentName);
    tone = tone.replace(/\[Keywords\]/g, keywordsText);

    const agentMission = getAgentMission(agentName);
    const mapCallouts = getMapCallouts(mapName);

    // --- BLOCO 1: Habilidades via valorant-api.com (PT-BR) ---
    let abilitiesBlock = "";
    try {
        const apiData = await getAgentAbilitiesFromAPI(agentName);
        if (apiData && apiData.abilities && apiData.abilities.length > 0) {
            const abilityLines = apiData.abilities
                .map(a => `  • ${a.name} (${a.slot}): ${a.description}`)
                .join('\n');
            abilitiesBlock = `\nKIT COMPLETO DO AGENTE (valorant-api.com PT-BR):\n${abilityLines}`;
        }
    } catch (e) {
        // Silencioso — fallback para keywords estáticas
    }

    // --- BLOCO 2: Contexto de Role (Obrigações Táticas) ---
    const roleObligation = getRoleObligations(playerRole);
    let roleContextBlock = "";
    if (roleObligation) {
        roleContextBlock = `
--- CONTEXTO DE FUNÇÃO: ${playerRole?.toUpperCase()} ---
MÉTRICA PRIMÁRIA: ${roleObligation.primary_metric}
MÉTRICAS SECUNDÁRIAS: ${roleObligation.secondary_metrics}
OBRIGAÇÕES TÁTICAS:
${roleObligation.obligations.map(o => `  • ${o}`).join('\n')}
INDICADORES DE SUCESSO: ${roleObligation.success_indicators}
INDICADORES DE FALHA: ${roleObligation.failure_indicators}
O COACH DEVE FOCAR EM: ${roleObligation.coach_must_check}
⚠️ NÃO PENALIZAR: ${roleObligation.do_not_penalize}`;
    }

    // --- BLOCO 3: Métricas contextualizadas por role ---
    const kastLine = kast !== null ? ` | KAST: ${kast}%` : '';
    const fbLine = firstKills !== null ? ` | First Bloods: ${firstKills}` : '';
    const clutchLine = clutches !== null ? ` | Clutches: ${clutches}` : '';

    const validSites = getValidSites(mapName);

    return `Atue como um Head Coach de Valorant Profissional especializado em análise por função tática.

--- MÉTRICAS TÉCNICAS (BASE FACTUAL) ---
RESULTADO: Score de Impacto: ${impactScore} | Rank: ${impactRank} | ADR: ${adr}${kastLine}${fbLine}${clutchLine}
KD: ${dados_supabase_match.kd} | AGENTE: ${agentName} | FUNÇÃO: ${playerRole || 'Desconhecida'} | MAPA: ${mapName}
MISSÃO TÁTICA: ${agentMission}
KEYWORDS DO KIT: ${keywordsText}${abilitiesBlock}
${roleContextBlock}

--- CALLOUTS DO MAPA (Use SOMENTE estes) ---
${mapCallouts}
Sites válidos neste mapa: ${validSites.join(', ')} (NUNCA mencione outros sites)

--- DIRETRIZES DE NARRATIVA ---
INSTRUÇÃO DE TOM: ${tone}

REGRAS OBRIGATÓRIAS:
1. Avalie o jogador EXCLUSIVAMENTE pela função declarada acima. Não penalize ${playerRole || 'o agente'} por métricas irrelevantes à sua função.
2. Use Português-BR impecável. NUNCA use termos corporativos (métrica, validação, iteração, alavancagem).
3. NUNCA use inglês desnecessário (feedback, dynamics, missions, subpar).
4. Se rank for Depósito de Torreta, seja sarcástico e cite falhas específicas do kit do agente.
5. Se rank for Alpha, elogie a dominância e a leitura de jogo superior em relação à função.
6. Use callouts BR reais do mapa acima — NUNCA invente posições que não existem.
7. NUNCA atribua habilidades que o agente não possui.

HISTÓRICO: ${historico_insights ? JSON.stringify(historico_insights) : 'Nenhum'}${squadText}

RESPOSTA OBRIGATÓRIA (Formato JSON puro, sem markdown):
{
    "diagnostico_principal": "Texto curto e impactante baseado na função e nas métricas reais",
    "pontos_fortes": ["Ponto forte específico da função 1", "Ponto forte 2"],
    "pontos_fracos": ["Falha específica da função 1", "Falha 2"],
    "nota_coach": "0.0 a 10.0"
}`;
}

// ─── COMPETIÇÃO DE MODELOS ────────────────────────────────────────────────────

/**
 * Pontua a qualidade de um insight gerado (0–100).
 * Recompensa especificidade, coerência com stats e português correto.
 */
function scoreInsight(insight, matchData) {
    if (!insight) return 0;

    let score = 50; // base — passou no validateInsightQuality

    const diag  = insight.diagnostico_principal || '';
    const fortes = Array.isArray(insight.pontos_fortes) ? insight.pontos_fortes : [];
    const fracos  = Array.isArray(insight.pontos_fracos)  ? insight.pontos_fracos  : [];
    const nota   = parseFloat(insight.nota_coach);
    const rank   = matchData?.rank || '';
    const agent  = (matchData?.agent || '').toLowerCase();

    // Diagnóstico rico e específico
    if (diag.length > 120) score += 15;
    else if (diag.length > 60) score += 8;
    else if (diag.length < 25) score -= 15;

    // Menciona o agente pelo nome
    if (agent && diag.toLowerCase().includes(agent)) score += 10;

    // Pontos específicos (longos = mais detalhados)
    for (const p of [...fortes, ...fracos]) {
        if (p.length > 35) score += 4;
        else if (p.length < 10) score -= 8;
    }
    if (fortes.length >= 2) score += 5;
    if (fracos.length >= 2) score += 5;

    // Nota coerente com o rank
    if (!isNaN(nota)) {
        if (rank === 'Alpha'             && nota >= 7.5) score += 12;
        if (rank === 'Depósito de Torreta' && nota <= 4.5) score += 12;
        if (rank === 'Omega'             && nota >= 5.0 && nota <= 7.5) score += 8;
        if (rank === 'Alpha'             && nota < 6.0) score -= 15; // nota baixa para herói
    }

    // Penalizar texto garbled (blocos de caps = lixo)
    const garbled = (diag.match(/[A-ZÁÉÍÓÚ]{6,}/g) || []).length;
    score -= garbled * 10;

    // Penalizar erros ortográficos clássicos de modelos pequenos
    const typoPattern = /\b\w*([a-z])\1{2,}\w*\b/g; // repetição de letras
    const typos = (diag.match(typoPattern) || []).length;
    score -= typos * 5;

    return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Chama o modelo local (Ollama) e retorna {insight, model_used} ou null.
 */
async function callLocal(sysPrompt, mapName, agentName) {
    if (!LOCAL_URL || !LOCAL_MODEL) return null;

    let localModel = LOCAL_MODEL;
    if (localModel.includes('--model')) localModel = localModel.split('--model').pop().trim();

    for (let attempt = 1; attempt <= 3; attempt++) {
        console.log(`🏠 [LOCAL] Tentativa ${attempt}/3: ${localModel}`);
        try {
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 120000);
            const resp = await fetch(`${LOCAL_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    model: localModel, stream: false,
                    messages: [
                        { role: 'system', content: 'Você é um assistente tático de Valorant. Responda APENAS em JSON válido.' },
                        { role: 'user', content: sysPrompt }
                    ],
                    temperature: 0.3
                })
            });
            clearTimeout(tid);
            if (resp.ok) {
                const json = await resp.json();
                let text = json.message?.content || '';
                text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
                const parsed = JSON.parse(cleanJSONResponse(text));
                if (validateInsightQuality(parsed, mapName, agentName)) {
                    console.log(`✅ [LOCAL] Aprovado (tentativa ${attempt}).`);
                    return { insight: parsed, model_used: `local-${localModel}` };
                }
                console.warn(`⚠️ [LOCAL] Tentativa ${attempt} reprovada no quality gate.`);
            }
        } catch (e) {
            console.warn(`⚠️ [LOCAL] Tentativa ${attempt} falhou: ${e.message}`);
        }
        if (attempt < 3) await new Promise(r => setTimeout(r, 2000));
    }
    return null;
}

/**
 * Chama um modelo OpenRouter específico e retorna {insight, model_used} ou null.
 */
async function callOpenRouter(model, sysPrompt, mapName, agentName) {
    if (!API_KEY) return null;
    console.log(`🧠 [OPENROUTER] Chamando: ${model}`);
    try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 60000);
        const resp = await fetch(OPENROUTER_URL, {
            method: 'POST', signal: controller.signal,
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://github.com/rodolphoborges/oraculo-v',
                'X-Title': 'Oraculo-V Intelligence Engine'
            },
            body: JSON.stringify({
                model,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: 'Você é um assistente tático de Valorant. Responda APENAS em JSON válido. Sem introduções.' },
                    { role: 'user', content: sysPrompt }
                ],
                temperature: 0.3
            })
        });
        clearTimeout(tid);
        if (resp.ok) {
            const json = await resp.json();
            const text = json.choices?.[0]?.message?.content || '';
            const parsed = JSON.parse(cleanJSONResponse(text));
            if (validateInsightQuality(parsed, mapName, agentName)) {
                console.log(`✅ [OPENROUTER] Aprovado: ${model}`);
                return { insight: parsed, model_used: model };
            }
            console.warn(`⚠️ [OPENROUTER] ${model} reprovado no quality gate.`);
        } else {
            const err = await resp.text();
            console.warn(`⚠️ [OPENROUTER] ${model} retornou ${resp.status}: ${err.slice(0, 120)}`);
        }
    } catch (e) {
        console.warn(`⚠️ [OPENROUTER] ${model} falhou: ${e.message}`);
    }
    return null;
}

/**
 * Gera insights em competição paralela:
 *   🏠 Local (Ollama)  +  🧠 OpenRouter modelo 1  +  🧠 OpenRouter modelo 2
 * Pontua cada resultado e retorna o de maior qualidade.
 */
export async function generateInsights(promptData) {
    const sysPrompt = await buildPrompt(
        promptData.match_data,
        promptData.trend,
        promptData.history || null,
        promptData.squad || []
    );

    const mapName  = promptData.match_data.map   || 'Desconhecido';
    const agentName = promptData.match_data.agent || null;

    // Os 2 melhores modelos gratuitos do OpenRouter para PT-BR
    const [OR_MODEL_1, OR_MODEL_2] = FALLBACK_MODELS;

    console.log('⚔️  [COMPETIÇÃO] Iniciando 3 gerações em paralelo...');

    const [localRes, or1Res, or2Res] = await Promise.allSettled([
        callLocal(sysPrompt, mapName, agentName),
        callOpenRouter(OR_MODEL_1, sysPrompt, mapName, agentName),
        callOpenRouter(OR_MODEL_2, sysPrompt, mapName, agentName),
    ]);

    const candidates = [localRes, or1Res, or2Res]
        .filter(r => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value);

    if (candidates.length === 0) {
        // Fallback sequencial nos demais modelos OpenRouter
        console.warn('⚠️  [COMPETIÇÃO] Nenhum candidato válido. Tentando fallback sequencial...');
        for (const model of FALLBACK_MODELS.slice(2)) {
            const result = await callOpenRouter(model, sysPrompt, mapName, agentName);
            if (result) return result;
        }
        console.error('❌ [CRÍTICO] Falha total da Inteligência.');
        return null;
    }

    // Pontua e ordena
    const scored = candidates.map(c => ({
        ...c,
        quality_score: scoreInsight(c.insight, promptData.match_data)
    })).sort((a, b) => b.quality_score - a.quality_score);

    console.log('🏆 [COMPETIÇÃO] Placar final:');
    scored.forEach((c, i) =>
        console.log(`  ${i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} ${c.model_used}: ${c.quality_score}pts`)
    );
    console.log(`✅ [COMPETIÇÃO] Vencedor: ${scored[0].model_used} (${scored[0].quality_score}pts)`);

    return scored[0];
}

/**
 * Utilitário para extrair apenas o objeto JSON de uma resposta poluída (Markdown, explainers, etc)
 */
function cleanJSONResponse(text) {
    if (!text) return "";
    
    // Remove tags de rascunho de modelos como DeepSeek/Qwen
    let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    
    // Tenta encontrar o primeiro { e o último }
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        return cleaned.substring(firstBrace, lastBrace + 1);
    }
    
    return cleaned;
}
