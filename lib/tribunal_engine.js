/**
 * lib/tribunal_engine.js
 *
 * Motor do Tribunal Tático — Análise Adversarial com Árbitro Evolutivo.
 *
 * 3 Personas:
 *   1. PERSPECTIVA ALIADA (Ex-Advogado) — Analisa suporte e sinergia do time.
 *   2. PERSPECTIVA RIVAL   (Ex-Promotor) — Analisa como o inimigo explorou o jogador.
 *   3. MENTOR K.A.I.O.     (Ex-Árbitro)  — Sintetiza o ensinamento final como um Head Coach.
 */

import { supabase } from './supabase.js';
import {
    getAgent, getValidSites, getMapCallouts, getRoleObligations, getAgentMission
} from './tactical_knowledge.js';
import { getAgentAbilitiesFromAPI } from './valorant_api.js';
import { validateInsightQuality } from './openrouter_engine.js';

// ─── CONFIGURAÇÃO DE MODELOS POR PERSONA ─────────────────────────────────────

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const LOCAL_URL = process.env.LOCAL_LLM_URL;
const LOCAL_MODEL = process.env.LOCAL_LLM_MODEL;

// Modelos para cada persona — configurável
const PERSONA_MODELS = {
    advocate:   { groq: 'llama-3.3-70b-versatile', openrouter: 'google/gemini-2.0-flash-exp:free' },
    prosecutor: { groq: 'llama-3.3-70b-versatile', openrouter: 'deepseek/deepseek-r1:free' },
    arbiter:    { groq: 'llama-3.3-70b-versatile', openrouter: 'google/gemini-2.0-flash-exp:free' }
};

// ─── EXTRAÇÃO DE DADOS DOS TIMES ─────────────────────────────────────────────

/**
 * Extrai stats detalhados de ambos os times a partir do match JSON.
 * @param {object} matchData - JSON completo do tracker.gg
 * @param {string} playerTag - Riot ID do jogador analisado
 * @param {string} playerTeam - Team ID do jogador ('Blue' ou 'Red')
 * @returns {{ allied: Array, enemy: Array, playerStats: object }}
 */
export function extractTeamContext(matchData, playerTag, playerTeam) {
    const segments = matchData.data.segments;
    const rounds = matchData.data.metadata.rounds || 1;
    const playerTagNorm = playerTag.replace(/\s/g, '').toUpperCase();

    const allied = [];
    const enemy = [];
    let playerStats = null;

    for (const seg of segments) {
        if (seg.type !== 'player-summary') continue;

        const pid = (seg.attributes?.platformUserIdentifier ||
                     seg.metadata?.platformUserIdentifier || '').replace(/\s/g, '').toUpperCase();
        const team = seg.metadata?.teamId || 'Unknown';
        const stats = seg.stats || {};

        const entry = {
            player_id: seg.attributes?.platformUserIdentifier || seg.metadata?.platformUserIdentifier || '?',
            agent: seg.metadata?.agentName || 'Unknown',
            team,
            kills: stats.kills?.value || 0,
            deaths: stats.deaths?.value || 0,
            assists: stats.assists?.value || 0,
            adr: Math.round((stats.damage?.value || 0) / rounds),
            kast: stats.kast?.value || 0,
            hs_pct: stats.hsAccuracy?.value || stats.headshotPercentage?.value || 0,
            acs: Math.round((stats.score?.value || 0) / rounds),
            kd: stats.deaths?.value > 0
                ? Math.round((stats.kills?.value / stats.deaths?.value) * 100) / 100
                : stats.kills?.value || 0
        };

        if (pid === playerTagNorm || pid.split('#')[0] === playerTagNorm.split('#')[0]) {
            playerStats = entry;
            allied.push(entry);
        } else if (team === playerTeam) {
            allied.push(entry);
        } else {
            enemy.push(entry);
        }
    }

    return { allied, enemy, playerStats };
}

/**
 * Formata array de stats de time para texto legível no prompt.
 */
function formatTeamStats(teamArray) {
    return teamArray.map(p =>
        `  • ${p.agent} (${p.player_id}): K:${p.kills} D:${p.deaths} A:${p.assists} | ADR:${p.adr} | KAST:${p.kast}% | KD:${p.kd} | HS:${Math.round(p.hs_pct)}%`
    ).join('\n');
}

// ─── PROMPTS DAS PERSONAS ────────────────────────────────────────────────────

const SYSTEM_ADVOCATE = [
    'Você é o ANALISTA DE SINERGIA do Protocolo V.',
    'Sua função é avaliar a performance do jogador sob a ótica do TIME ALIADO.',
    'DIRETRIZ DE ESTILO: Fale DIRETAMENTE com o jogador usando "você", "seu", "sua".',
    'ERRO: "O jogador buscou o abate". CORRETO: "Você buscou o abate e salvou o time".',
    'Identifique méritos técnicos, momentos onde você salvou o time e onde os aliados falharam em dar suporte.',
    'Use Português-BR natural e encorajador. NUNCA use termos jurídicos, corporativos ou fale em terceira pessoa.'
].join(' ');

const SYSTEM_PROSECUTOR = [
    'Você é o ANALISTA RIVAL do Protocolo V.',
    'Sua função é avaliar a performance do jogador sob a ótica do TIME ADVERSÁRIO.',
    'DIRETRIZ DE ESTILO: Fale DIRETAMENTE com o jogador. Ele é o alvo que você estudou.',
    'ERRO: "O Chamber foi neutralizado". CORRETO: "O inimigo conseguiu te neutralizar".',
    'Mostre onde você foi "lido", explorado ou neutralizado pela estratégia rival.',
    'Use Português-BR direto e focado em adaptação. NUNCA use termos jurídicos, corporativos ou fale em terceira pessoa.'
].join(' ');

const SYSTEM_ARBITER = [
    'Você é o K.A.I.O., MESTRE TÁTICO E MENTOR SUPREMO do Protocolo V.',
    'Sua missão é dar ENSINAMENTOS táticos valiosos diretamente ao jogador.',
    'Aja como um HEAD COACH de elite: pedagógico, firme e focado no crescimento dele.',
    'REGRA DE OURO: NUNCA mencione "Advogado", "Promotor", "Tribunal", "O Jogador" ou "O Agente".',
    'VOCÊ DEVE FALAR COM O JOGADOR NA 2ª PESSOA ("Você", "Seu", "Sua").',
    'ERRO: "A performance de Chamber foi sólida". CORRETO: "Você jogou de forma sólida com seu Chamber".',
    'Sintetize a verdade técnica como um conselho de mestre. Responda APENAS em JSON válido.'
].join(' ');

/**
 * Constrói prompt para a Perspectiva Aliada (Ex-Advogado).
 */
async function buildAdvocatePrompt(matchData, analysisResult, teamContext) {
    const { allied, playerStats } = teamContext;
    const agentName = analysisResult.agent || 'Combatente';
    const mapName = analysisResult.map || 'Desconhecido';
    const role = analysisResult.role || 'Duelista';
    const validSites = getValidSites(mapName);
    const mapCallouts = getMapCallouts(mapName);
    const roleObligation = getRoleObligations(role);
    const crossRound = analysisResult.cross_round;

    let temporalBlock = '';
    if (crossRound) {
        const h1 = crossRound.half_1;
        const h2 = crossRound.half_2;
        const lines = [];
        if (h1?.rounds > 0 && h2?.rounds > 0) {
            lines.push(`1º TURNO: K/D ${h1.kills}/${h1.deaths} (${h1.kd}) | ADR ${h1.adr}`);
            lines.push(`2º TURNO: K/D ${h2.kills}/${h2.deaths} (${h2.kd}) | ADR ${h2.adr}`);
        }
        if (crossRound.trade_rate != null)
            lines.push(`Taxa de Trade do time: ${crossRound.trade_rate}%`);
        if (lines.length > 0)
            temporalBlock = `\n--- ANÁLISE TEMPORAL ---\n${lines.join('\n')}`;
    }

    let roleBlock = '';
    if (roleObligation) {
        roleBlock = `
--- OBRIGAÇÕES DA FUNÇÃO: ${role.toUpperCase()} ---
MÉTRICA PRIMÁRIA: ${roleObligation.primary_metric}
OBRIGAÇÕES: ${roleObligation.obligations.map(o => `• ${o}`).join(' ')}
SUCESSO: ${roleObligation.success_indicators}
FALHA: ${roleObligation.failure_indicators}`;
    }

    return `Analise ${playerStats?.player_id || 'jogador'} (${agentName}, ${role}) pela perspectiva do TIME ALIADO.

--- STATS DO JOGADOR ---
Performance Index: ${analysisResult.performance_index} | Rank Técnico: ${analysisResult.technical_rank}
K/D: ${analysisResult.kd} | ADR: ${analysisResult.adr} | KAST: ${analysisResult.kast || '?'}% | ACS: ${analysisResult.acs}
First Bloods: ${analysisResult.first_kills} | Clutches: ${analysisResult.clutches} | Resultado: ${analysisResult.result}
MAPA: ${mapName} | Sites válidos: ${validSites.join(', ')}
${roleBlock}${temporalBlock}

--- TIME ALIADO (contexto de suporte) ---
${formatTeamStats(allied)}

--- CALLOUTS DO MAPA ---
${mapCallouts}

REGRAS:
1. Fale DIRETAMENTE com o jogador: "Você compensou...", "Seu time não tradou..."
2. Identifique onde os aliados falharam em dar suporte (trades não feitos, rotações tardias)
3. Identifique onde o jogador COMPENSOU falhas do time
4. Se o jogador falhou mesmo com bom suporte, reconheça honestamente
5. CRUZE dados do jogador com os aliados — não analise isoladamente
6. NUNCA atribua habilidades que ${agentName} não possui
7. NUNCA mencione sites que não existem neste mapa
8. NUNCA use termos como "O jogador", "O agente", "A performance" — fale com ELE

JSON OBRIGATÓRIO:
{
    "diagnostico_aliado": "Conclusão sobre a performance considerando o contexto do time aliado",
    "pontos_fortes": ["Mérito 1 fundamentado nos dados", "Mérito 2"],
    "pontos_fracos": ["Falha 1 mesmo considerando o time", "Falha 2"],
    "contexto_time": "Como o time aliado impactou (positiva ou negativamente) a performance",
    "nota_advocate": "0.0 a 10.0"
}`;
}

/**
 * Constrói prompt para a Perspectiva Rival (Ex-Promotor).
 */
async function buildProsecutorPrompt(matchData, analysisResult, teamContext) {
    const { enemy, playerStats } = teamContext;
    const agentName = analysisResult.agent || 'Combatente';
    const mapName = analysisResult.map || 'Desconhecido';
    const role = analysisResult.role || 'Duelista';
    const validSites = getValidSites(mapName);
    const mapCallouts = getMapCallouts(mapName);
    const crossRound = analysisResult.cross_round;

    let temporalBlock = '';
    if (crossRound) {
        const lines = [];
        if (crossRound.opening_duel_wr != null)
            lines.push(`Duelos de Abertura: ${crossRound.opening_duel_wr}% de aproveitamento`);
        if (crossRound.max_neg_streak > 2)
            lines.push(`Maior sequência negativa: ${crossRound.max_neg_streak} rounds consecutivos`);
        const bt = crossRound.by_type || {};
        if (bt.eco?.rounds > 0)
            lines.push(`Rounds Eco: ${bt.eco.kills}K/${bt.eco.deaths}D em ${bt.eco.rounds} rounds`);
        if (lines.length > 0)
            temporalBlock = `\n--- VULNERABILIDADES TEMPORAIS ---\n${lines.join('\n')}`;
    }

    // Identifica matchups diretos (agentes inimigos vs o agente do jogador)
    const enemyAgents = enemy.map(e => e.agent).join(', ');

    return `Analise ${playerStats?.player_id || 'jogador'} (${agentName}, ${role}) pela perspectiva do TIME ADVERSÁRIO.

--- STATS DO JOGADOR (ALVO) ---
Performance Index: ${analysisResult.performance_index} | Rank Técnico: ${analysisResult.technical_rank}
K/D: ${analysisResult.kd} | ADR: ${analysisResult.adr} | KAST: ${analysisResult.kast || '?'}% | ACS: ${analysisResult.acs}
First Bloods: ${analysisResult.first_kills} | First Deaths: ${analysisResult.first_deaths} | Clutches: ${analysisResult.clutches}
Resultado: ${analysisResult.result}
MAPA: ${mapName} | Sites válidos: ${validSites.join(', ')}
${temporalBlock}

--- TIME ADVERSÁRIO (quem explorou o jogador) ---
${formatTeamStats(enemy)}
COMPOSIÇÃO RIVAL: ${enemyAgents}

--- CALLOUTS DO MAPA ---
${mapCallouts}

REGRAS:
1. Identifique quais agentes rivais EXPLORARAM fraquezas do jogador
2. Analise matchups de agente: ${agentName} vs cada agente rival — quem levou vantagem?
3. Identifique rounds/situações onde a composição rival NEUTRALIZOU o jogador
4. Se o jogador resistiu bem à pressão adversária, reconheça — mas explique O QUE o rival tentou
5. NUNCA atribua habilidades que ${agentName} não possui
6. NUNCA mencione sites que não existem neste mapa

JSON OBRIGATÓRIO:
{
    "diagnostico_rival": "Como o time adversário impactou/explorou a performance do jogador",
    "pontos_fortes": ["Ponto positivo contra o rival 1", "Mérito 2"],
    "pontos_fracos": ["Exploração sofrida 1", "Vulnerabilidade exposta 2"],
    "matchups_chave": "Quem foi seu maior problema no time rival?",
    "nota_rival": "0.0 a 10.0"
}`;
}

/**
 * Constrói prompt para o MENTOR K.A.I.O. (Ex-Árbitro).
 */
function buildArbiterPrompt(advocateInsight, prosecutorInsight, analysisResult, knowledgeBase) {
    const agentName = analysisResult.agent || 'Combatente';
    const mapName = analysisResult.map || 'Desconhecido';
    const role = analysisResult.role || 'Duelista';

    return `Você é o Coach K.A.I.O. analisando a partida de ${agentName} (${role}) em ${mapName}.
Recebemos dois relatórios técnicos internos sobre este jogador. Sua missão é dar o veredito do treinador.

=== RELATÓRIO DE SINERGIA (Visão Aliada) ===
${JSON.stringify(advocateInsight, null, 2)}

=== RELATÓRIO OPERACIONAL (Visão Rival) ===
${JSON.stringify(prosecutorInsight, null, 2)}

=== DADOS DE CAMPO (Fatores Reais) ===
Impacto: ${analysisResult.performance_index} | Rank: ${analysisResult.technical_rank}
K/D: ${analysisResult.kd} | ADR: ${analysisResult.adr} | KAST: ${analysisResult.kast || '?'}%
Aberturas: ${analysisResult.first_kills} | Clutches: ${analysisResult.clutches}
Resultado: ${analysisResult.result} | Mapa: ${mapName}

=== SUA EXPERIÊNCIA ANTERIOR (Memória de Longo Prazo) ===
${knowledgeBase.length > 0 ? knowledgeBase.map(k => `• [${k.pattern_type}] ${k.context_key}: ${k.observation}`).join('\n') : 'Primeira análise deste perfil.'}

SUAS OBRIGAÇÕES COMO COACH:
1. TRADUZA os dados técnicos em conselhos práticos e pedagógicos.
2. NUNCA diga "o advogado disse" ou "segundo o promotor". Fale como SEU conhecimento: "Notei que você..." ou "Sua sinergia com o time...".
3. Identifique PADRÕES REAIS: o que aconteceu DE FATO nesta partida?
4. A nota (0-10) deve ser sua avaliação honesta da execução tática do jogador.
5. Liste pontos fortes e falhas críticas como ENSINAMENTOS, não como ataques.

JSON OBRIGATÓRIO:
{
    "diagnostico_principal": "Seu ensinamento mestre para o jogador (Direto, sem citar personas)",
    "pontos_fortes": ["Destaque tático 1 validado", "Destaque 2"],
    "pontos_fracos": ["Falha tática a corrigir 1", "Falha 2"],
    "nota_coach": "0.0 a 10.0",
    "analise_vencedora": "advocate" | "prosecutor" | "empate",
    "razao_escolha": "Explicação interna do coach sobre qual visão foi mais precisa (para logs)",
    "padroes_aprendidos": [
        {
            "pattern_type": "tipo_do_padrao",
            "context_key": "chave_contexto_especifica",
            "observation": "Insight tático novo sobre este mapa/agente para sua memória"
        }
    ]
}`;
}

// ─── CHAMADAS LLM POR PERSONA ────────────────────────────────────────────────

function cleanJSONResponse(text) {
    if (!text) return '';
    let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first !== -1 && last !== -1 && last > first) {
        return cleaned.substring(first, last + 1);
    }
    return cleaned;
}

/**
 * Chama um LLM para uma persona específica.
 * Cascata: Local → Groq → OpenRouter
 */
async function callPersona(systemPrompt, userPrompt, personaName, mapName, agentName) {
    // 1. LOCAL (Ollama)
    if (LOCAL_URL && LOCAL_MODEL) {
        try {
            let model = LOCAL_MODEL;
            if (model.includes('--model')) model = model.split('--model').pop().trim();

            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 180000); // 3 min por persona
            const resp = await fetch(`${LOCAL_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    model,
                    stream: false,
                    format: 'json',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    options: {
                        num_ctx: 8192,
                        num_predict: 1024,
                        temperature: 0.3,
                        top_p: 0.8,
                        repeat_penalty: 1.3
                    },
                    keep_alive: -1
                })
            });
            clearTimeout(tid);
            if (resp.ok) {
                const json = await resp.json();
                const parsed = JSON.parse(json.message?.content || '{}');
                console.log(`✅ [TRIBUNAL/${personaName.toUpperCase()}] Local aprovado.`);
                return { insight: parsed, model_used: `local-${model}` };
            }
        } catch (e) {
            console.warn(`⚠️ [TRIBUNAL/${personaName.toUpperCase()}] Local falhou: ${e.message}`);
        }
    }

    // 2. GROQ
    const groqModel = PERSONA_MODELS[personaName]?.groq;
    if (GROQ_API_KEY && groqModel) {
        try {
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 45000);
            const resp = await fetch(GROQ_URL, {
                method: 'POST',
                signal: controller.signal,
                headers: {
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: groqModel,
                    response_format: { type: 'json_object' },
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: 0.3,
                    max_tokens: 1024
                })
            });
            clearTimeout(tid);
            if (resp.ok) {
                const json = await resp.json();
                const text = json.choices?.[0]?.message?.content || '';
                const parsed = JSON.parse(cleanJSONResponse(text));
                console.log(`✅ [TRIBUNAL/${personaName.toUpperCase()}] Groq aprovado: ${groqModel}`);
                return { insight: parsed, model_used: `groq-${groqModel}` };
            }
        } catch (e) {
            console.warn(`⚠️ [TRIBUNAL/${personaName.toUpperCase()}] Groq falhou: ${e.message}`);
        }
    }

    // 3. OPENROUTER
    const orModel = PERSONA_MODELS[personaName]?.openrouter;
    if (OPENROUTER_KEY && orModel) {
        try {
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 60000);
            const resp = await fetch(OPENROUTER_URL, {
                method: 'POST',
                signal: controller.signal,
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://github.com/rodolphoborges/oraculo-v',
                    'X-Title': 'Oraculo-V Tribunal Engine'
                },
                body: JSON.stringify({
                    model: orModel,
                    response_format: { type: 'json_object' },
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: 0.3,
                    max_tokens: 1024
                })
            });
            clearTimeout(tid);
            if (resp.ok) {
                const json = await resp.json();
                const text = json.choices?.[0]?.message?.content || '';
                const parsed = JSON.parse(cleanJSONResponse(text));
                console.log(`✅ [TRIBUNAL/${personaName.toUpperCase()}] OpenRouter aprovado: ${orModel}`);
                return { insight: parsed, model_used: orModel };
            }
        } catch (e) {
            console.warn(`⚠️ [TRIBUNAL/${personaName.toUpperCase()}] OpenRouter falhou: ${e.message}`);
        }
    }

    console.error(`❌ [TRIBUNAL/${personaName.toUpperCase()}] Todas as LLMs falharam.`);
    return null;
}

// ─── BASE DE CONHECIMENTO DO ÁRBITRO ─────────────────────────────────────────

/**
 * Carrega padrões relevantes da base do Árbitro para o contexto da partida.
 */
export async function loadArbiterKnowledge(agentName, mapName, enemyAgents = []) {
    if (!supabase) return [];

    try {
        // Busca padrões com maior confidence, filtrando por contexto relevante
        const contextKeys = [
            agentName?.toLowerCase(),
            mapName?.toLowerCase(),
            ...enemyAgents.map(a => a.toLowerCase())
        ].filter(Boolean);

        // Busca os top 50 padrões por confidence
        const { data, error } = await supabase
            .from('arbiter_knowledge')
            .select('*')
            .gte('confidence', 0.3)
            .order('confidence', { ascending: false })
            .limit(50);

        if (error || !data) return [];

        // Filtra por relevância ao contexto atual
        const relevant = data.filter(k => {
            const key = k.context_key.toLowerCase();
            return contextKeys.some(ctx => key.includes(ctx));
        }).slice(0, 15);

        // Se não encontrou relevantes, retorna os top globais
        if (relevant.length === 0) {
            return data.filter(k => k.confidence >= 0.6).slice(0, 10);
        }

        return relevant;
    } catch (err) {
        console.warn(`⚠️ [ARBITER-KB] Falha ao carregar base: ${err.message}`);
        return [];
    }
}

/**
 * Persiste padrões aprendidos pelo Árbitro (upsert com evolução de confidence).
 */
export async function updateArbiterKnowledge(patterns, matchId) {
    if (!supabase || !patterns || !Array.isArray(patterns)) return 0;

    let updated = 0;

    for (const pattern of patterns) {
        if (!pattern.pattern_type || !pattern.context_key || !pattern.observation) continue;

        const key = pattern.context_key.toLowerCase().replace(/\s+/g, '_');
        const type = pattern.pattern_type.toLowerCase();

        try {
            // Tenta buscar padrão existente
            const { data: existing } = await supabase
                .from('arbiter_knowledge')
                .select('id, times_seen, times_confirmed, confidence')
                .eq('pattern_type', type)
                .eq('context_key', key)
                .single();

            if (existing) {
                // Atualiza: incrementa contagem e ajusta confidence (bayesiano simples)
                const newSeen = existing.times_seen + 1;
                const newConfirmed = existing.times_confirmed + 1;
                // Confidence converge para a taxa de confirmação real
                const newConfidence = Math.min(0.95, (newConfirmed / newSeen) * 0.8 + existing.confidence * 0.2);

                await supabase
                    .from('arbiter_knowledge')
                    .update({
                        times_seen: newSeen,
                        times_confirmed: newConfirmed,
                        confidence: Math.round(newConfidence * 1000) / 1000,
                        observation: pattern.observation,
                        last_match_id: matchId,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id);
            } else {
                // Insere novo padrão
                await supabase
                    .from('arbiter_knowledge')
                    .insert({
                        pattern_type: type,
                        context_key: key,
                        observation: pattern.observation,
                        confidence: 0.5,
                        times_seen: 1,
                        times_confirmed: 1,
                        last_match_id: matchId
                    });
            }
            updated++;
        } catch (err) {
            console.warn(`⚠️ [ARBITER-KB] Falha ao persistir padrão "${key}": ${err.message}`);
        }
    }

    if (updated > 0) {
        console.log(`🧠 [ARBITER-KB] ${updated} padrão(ões) atualizado(s) na base de conhecimento.`);
    }
    return updated;
}

/**
 * Persiste o veredito completo do Tribunal na tabela tribunal_verdicts.
 */
async function saveVerdict(matchId, playerId, advocateResult, prosecutorResult, arbiterResult) {
    if (!supabase) return;

    try {
        await supabase.from('tribunal_verdicts').insert({
            match_id: matchId,
            player_id: playerId,
            advocate_insight: advocateResult?.insight || {},
            prosecutor_insight: prosecutorResult?.insight || {},
            arbiter_verdict: arbiterResult?.insight || {},
            winning_persona: arbiterResult?.insight?.analise_vencedora || 'empate',
            advocate_model: advocateResult?.model_used || 'none',
            prosecutor_model: prosecutorResult?.model_used || 'none',
            arbiter_model: arbiterResult?.model_used || 'none',
            patterns_learned: arbiterResult?.insight?.padroes_aprendidos?.length || 0
        });
    } catch (err) {
        console.warn(`⚠️ [TRIBUNAL] Falha ao salvar veredito: ${err.message}`);
    }
}

// ─── PIPELINE PRINCIPAL DO TRIBUNAL ──────────────────────────────────────────

/**
 * Executa o Tribunal Tático completo.
 *
 * @param {object} matchData - JSON completo do tracker.gg
 * @param {object} analysisResult - Resultado do analyze_valorant.py
 * @param {string} playerTag - Riot ID do jogador
 * @param {string} matchId - UUID da partida
 * @returns {{ insight: object, model_used: string, tribunal_meta: object }}
 */
export async function runTribunal(matchData, analysisResult, playerTag, matchId) {
    console.log(`\n⚖️ ═══════════════════════════════════════════════════`);
    console.log(`⚖️  TRIBUNAL TÁTICO — ${playerTag}`);
    console.log(`⚖️ ═══════════════════════════════════════════════════\n`);

    const playerTeam = analysisResult.squad_stats ?
        (matchData.data.segments.find(s => {
            if (s.type !== 'player-summary') return false;
            const pid = (s.attributes?.platformUserIdentifier || '').replace(/\s/g, '').toUpperCase();
            return pid === playerTag.replace(/\s/g, '').toUpperCase() ||
                   pid.split('#')[0] === playerTag.replace(/\s/g, '').toUpperCase().split('#')[0];
        })?.metadata?.teamId || 'Blue') : 'Blue';

    // 1. Extrair contexto dos dois times
    const teamContext = extractTeamContext(matchData, playerTag, playerTeam);

    if (!teamContext.playerStats) {
        console.warn(`⚠️ [TRIBUNAL] Jogador não encontrado nos segments. Abortando tribunal.`);
        return null;
    }

    const enemyAgents = teamContext.enemy.map(e => e.agent);
    const agentName = analysisResult.agent;
    const mapName = analysisResult.map;

    // 2. Construir prompts (Advogado e Promotor em paralelo)
    console.log(`📋 [TRIBUNAL] Construindo argumentos...`);
    const [advocatePrompt, prosecutorPrompt] = await Promise.all([
        buildAdvocatePrompt(matchData, analysisResult, teamContext),
        buildProsecutorPrompt(matchData, analysisResult, teamContext)
    ]);

    // 3. Executar Advogado e Promotor EM PARALELO
    console.log(`🗣️  [TRIBUNAL] Advogado e Promotor debatendo em paralelo...`);
    const [advocateResult, prosecutorResult] = await Promise.all([
        callPersona(SYSTEM_ADVOCATE, advocatePrompt, 'advocate', mapName, agentName),
        callPersona(SYSTEM_PROSECUTOR, prosecutorPrompt, 'prosecutor', mapName, agentName)
    ]);

    // Fallback: se ambas as personas falharem, retorna null para usar pipeline original
    if (!advocateResult && !prosecutorResult) {
        console.error(`❌ [TRIBUNAL] Ambas as personas falharam. Fallback para pipeline original.`);
        return null;
    }

    // Se apenas uma falhou, constrói um placeholder
    const advocateInsight = advocateResult?.insight || {
        diagnostico_aliado: 'Análise não disponível (falha na persona)',
        pontos_fortes: [], pontos_fracos: [],
        contexto_time: 'Indisponível', nota_advocate: '5.0'
    };
    const prosecutorInsight = prosecutorResult?.insight || {
        diagnostico_rival: 'Análise não disponível (falha na persona)',
        pontos_fortes: [], pontos_fracos: [],
        matchups_chave: 'Indisponível', nota_prosecutor: '5.0'
    };

    // 4. Carregar base de conhecimento do Árbitro
    console.log(`📚 [TRIBUNAL] Carregando base de conhecimento do Árbitro...`);
    const knowledgeBase = await loadArbiterKnowledge(agentName, mapName, enemyAgents);
    console.log(`📚 [TRIBUNAL] ${knowledgeBase.length} padrões relevantes carregados.`);

    // 5. Executar Árbitro
    console.log(`⚖️  [TRIBUNAL] Árbitro deliberando...`);
    const arbiterPrompt = buildArbiterPrompt(advocateInsight, prosecutorInsight, analysisResult, knowledgeBase);
    const arbiterResult = await callPersona(SYSTEM_ARBITER, arbiterPrompt, 'arbiter', mapName, agentName);

    if (!arbiterResult) {
        // Fallback: usa a persona com nota mais alta
        console.warn(`⚠️ [TRIBUNAL] Árbitro falhou. Selecionando melhor persona por nota.`);
        const advNota = parseFloat(advocateInsight.nota_advocate) || 0;
        const prosNota = parseFloat(prosecutorInsight.nota_prosecutor) || 0;
        const winner = advNota >= prosNota ? advocateInsight : prosecutorInsight;

        return {
            insight: {
                diagnostico_principal: winner.diagnostico_aliado || winner.diagnostico_rival || 'Análise parcial do tribunal.',
                pontos_fortes: winner.pontos_fortes || [],
                pontos_fracos: winner.pontos_fracos || [],
                nota_coach: String(Math.max(advNota, prosNota)),
                classification: analysisResult.technical_rank
            },
            model_used: `tribunal-fallback(${advocateResult?.model_used || 'none'}/${prosecutorResult?.model_used || 'none'})`,
            tribunal_meta: { advocate: advocateResult, prosecutor: prosecutorResult, arbiter: null, patterns_learned: 0 }
        };
    }

    const verdict = arbiterResult.insight;

    // 6. Atualizar base de conhecimento com padrões aprendidos
    let patternsLearned = 0;
    if (verdict.padroes_aprendidos && Array.isArray(verdict.padroes_aprendidos)) {
        patternsLearned = await updateArbiterKnowledge(verdict.padroes_aprendidos, matchId);
    }

    // 7. Salvar veredito completo (audit trail)
    await saveVerdict(matchId, playerTag, advocateResult, prosecutorResult, arbiterResult);

    console.log(`\n⚖️ ═══════════════════════════════════════════════════`);
    console.log(`⚖️  VEREDITO: ${verdict.analise_vencedora?.toUpperCase() || 'EMPATE'}`);
    console.log(`⚖️  Nota: ${verdict.nota_coach} | Padrões aprendidos: ${patternsLearned}`);
    console.log(`⚖️ ═══════════════════════════════════════════════════\n`);

    // 8. Retorna no formato compatível com o pipeline existente
    return {
        insight: {
            diagnostico_principal: verdict.diagnostico_principal,
            pontos_fortes: verdict.pontos_fortes || [],
            pontos_fracos: verdict.pontos_fracos || [],
            nota_coach: verdict.nota_coach,
            classification: analysisResult.technical_rank,
            analise_vencedora: verdict.analise_vencedora,
            razao_escolha: verdict.razao_escolha
        },
        model_used: `tribunal(${advocateResult?.model_used || '?'}/${prosecutorResult?.model_used || '?'}/${arbiterResult.model_used})`,
        tribunal_meta: {
            advocate: advocateResult,
            prosecutor: prosecutorResult,
            arbiter: arbiterResult,
            patterns_learned: patternsLearned,
            knowledge_count: knowledgeBase.length
        }
    };
}
