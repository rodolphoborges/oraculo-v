/**
 * lib/valorant_api.js
 *
 * Integração com valorant-api.com (Community API).
 * Busca dados dinâmicos de agentes: habilidades, roles e descrições em PT-BR.
 * Cache em memória de 24h para evitar requisições repetidas a cada análise.
 *
 * Endpoint base: https://valorant-api.com/v1
 */

const VALORANT_API_BASE = 'https://valorant-api.com/v1';

// Cache em memória — persiste durante o ciclo de vida do processo
let _agentCache = null;
let _cacheTimestamp = null;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

/**
 * Busca todos os agentes jogáveis da API com locale PT-BR.
 * Retorna null em caso de falha (sistema cai para dados estáticos).
 */
async function fetchAgentsFromAPI() {
    const now = Date.now();
    if (_agentCache && _cacheTimestamp && (now - _cacheTimestamp) < CACHE_TTL_MS) {
        return _agentCache;
    }

    try {
        const response = await fetch(
            `${VALORANT_API_BASE}/agents?isPlayableCharacter=true&language=pt-BR`,
            { signal: AbortSignal.timeout(8000) }
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        if (data.status !== 200 || !Array.isArray(data.data)) {
            throw new Error(`Payload inválido da valorant-api.com`);
        }

        _agentCache = data.data;
        _cacheTimestamp = now;
        console.log(`[VALORANT-API] ${_agentCache.length} agentes carregados (PT-BR).`);
        return _agentCache;
    } catch (err) {
        console.warn(`[VALORANT-API] Falha ao buscar agentes: ${err.message}. Usando dados estáticos.`);
        return null;
    }
}

/**
 * Normaliza nome de agente para comparação robusta (ex: "KAY/O" → "kayo").
 */
function normalizeName(name = '') {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Retorna as habilidades de um agente com descrições em PT-BR via valorant-api.com.
 * Fallback gracioso: retorna null se a API estiver indisponível.
 *
 * @param {string} agentName - Nome do agente (ex: "Sage", "KAY/O")
 * @returns {Promise<{name: string, role: string, description: string, abilities: Array}|null>}
 */
export async function getAgentAbilitiesFromAPI(agentName) {
    if (!agentName) return null;

    const agents = await fetchAgentsFromAPI();
    if (!agents) return null;

    const normalizedInput = normalizeName(agentName);
    const agent = agents.find(a => normalizeName(a.displayName) === normalizedInput);
    if (!agent) {
        console.warn(`[VALORANT-API] Agente não encontrado na API: ${agentName}`);
        return null;
    }

    return {
        name: agent.displayName,
        role: agent.role?.displayName || null,
        description: agent.description,
        abilities: agent.abilities
            .filter(a => a.displayName && a.description)
            .map(a => ({
                slot: a.slot,       // "Ability1", "Ability2", "Grenade", "Ultimate"
                name: a.displayName,
                description: a.description
            }))
    };
}

/**
 * Retorna apenas o nome do role de um agente via API (PT-BR).
 * Útil como fallback de resolução de role.
 *
 * @param {string} agentName
 * @returns {Promise<string|null>}
 */
export async function getAgentRoleFromAPI(agentName) {
    if (!agentName) return null;
    const agents = await fetchAgentsFromAPI();
    if (!agents) return null;

    const normalizedInput = normalizeName(agentName);
    const agent = agents.find(a => normalizeName(a.displayName) === normalizedInput);
    return agent?.role?.displayName || null;
}
