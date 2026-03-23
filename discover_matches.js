/**
 * discover_matches.js
 * 
 * Radar script that performs the "Match Discovery" phase.
 * It periodically scans the match history of players registered in Protocolo-V
 * and identifies group matches (intersections) to queue for analysis in Oráculo-V.
 * 
 * Dependencies:
 * - Henrik API (Valorant Data)
 * - Supabase (Protocol & Oráculo databases)
 */
import { supabase, supabaseProtocol, getSupabaseConfig } from './lib/supabase.js';
const HENRIK_API_KEY = process.env.HENRIK_API_KEY;

if (!HENRIK_API_KEY || HENRIK_API_KEY === 'your_henrik_api_key_v3') {
    console.error("❌ ERRO: HENRIK_API_KEY não configurada.");
    console.error("Certifique-se de definir a chave no arquivo .env local ou nos Secrets do GitHub (CI/CD).");
    console.error("Obtenha uma chave em: https://henrikdev.xyz/dashboard");
    process.exit(1);
}

/**
 * discover_matches.js
 * 
 * Este script varre os jogadores cadastrados no Protocolo V,
 * busca as últimas partidas e identifica quando 2 ou mais 
 * jogaram juntos, salvando na fila de análise.
 */

const delay = ms => new Promise(res => setTimeout(res, ms));

async function discover() {
    const config = getSupabaseConfig();
    const mask = (url) => url ? url.replace(/(https?:\/\/).{4}/, "$1****") : 'MISSING';
    console.log(`🔍 [RADAR] Iniciando (Fonte: ${mask(config.protocolUrl)} | Fila: ${mask(config.oraculoUrl)})...`);

    // 1. Buscar todos os jogadores ativos (DA BASE DO PROTOCOLO)
    const { data: players, error: pError } = await supabaseProtocol
        .from('players')
        .select('riot_id, telegram_id')
        .not('riot_id', 'is', null);

    if (pError || !players) {
        console.error("❌ Erro ao buscar jogadores:", pError);
        return;
    }

    console.log(`📡 Monitorando ${players.length} agentes.`);

    const matchHistory = {}; // match_id -> Set of players
    const matchToTags = {};  // match_id -> List of full tags (Nick#Tag)

    // 2. Coletar histórico recente (últimas 3 partidas de cada um)
    for (const p of players) {
        const [name, tag] = p.riot_id.split('#');
        if (!name || !tag) continue;

        try {
            console.log(`📡 Escaneando histórico: ${p.riot_id}...`);
            const url = `https://api.henrikdev.xyz/valorant/v3/matches/br/${encodeURIComponent(name)}/${encodeURIComponent(tag)}?size=20`;
            const res = await fetch(url, {
                headers: { 'Authorization': HENRIK_API_KEY }
            });

            if (res.status === 429) {
                console.warn(`⏳ Rate Limit Atingido (Status: 429). Pausando por 5 segundos...`);
                await delay(5000);
                continue; // Pula este e segue pro próximo após a pausa
            }

            if (res.status !== 200) {
                console.warn(`⚠️ Falha ao buscar ${p.riot_id} (Status: ${res.status})`);
                continue;
            }

            const json = await res.json();
            if (!json.data) continue;

            // Inverter para processar da mais antiga para a mais recente (Cronológico)
            const chronologicalMatches = [...json.data].reverse();

            for (const match of chronologicalMatches) {
                if (!match?.metadata?.matchid) continue;
                
                // FILTRO DE ELITE: Apenas partidas competitivas
                const mode = match.metadata.mode || "";
                if (mode.toLowerCase() !== 'competitive') {
                    // console.log(`⏭️ Pulando partida ${match.metadata.matchid} (Modo: ${mode})`);
                    continue;
                }
                
                const mid = match.metadata.matchid;
                if (!matchHistory[mid]) {
                    matchHistory[mid] = new Set();
                    matchToTags[mid] = [];
                }

                // ESTRATÉGIA DE EXPANSÃO: Além do jogador 'p', buscar todos os outros na partida
                // que também estão no seu banco de dados (Protocolo V).
                const playersInThisMatch = match.players?.all_players || [];
                const registeredPlayers = players.map(pl => pl.riot_id.toUpperCase());

                playersInThisMatch.forEach(playerInMatch => {
                    const tagInMatch = `${playerInMatch.name}#${playerInMatch.tag}`;
                    if (registeredPlayers.includes(tagInMatch.toUpperCase())) {
                        if (!matchHistory[mid].has(tagInMatch)) {
                            matchHistory[mid].add(tagInMatch);
                            matchToTags[mid].push(tagInMatch);
                        }
                    }
                });
            }
        } catch (err) {
            console.error(`🔥 Erro ao processar ${p.riot_id}:`, err.message);
        }

        // Delay anti-ban para a API gratuita do Henrik (~2s para ser seguro)
        await delay(2000);
    }

    // 3. Filtrar partidas com INTERSEÇÃO (1+ para diagnóstico de inserção)
    const jointMatches = Object.keys(matchHistory).filter(mid => matchHistory[mid].size >= 1);
    console.log(`🎯 Encontradas ${jointMatches.length} partidas em grupo potenciais.`);
    
    if (jointMatches.length === 0) {
        // Log extra para depurar por que 0 partidas foram encontradas
        const totalDistinctMatches = Object.keys(matchHistory).length;
        console.log(`ℹ️ Debug: Scaneadas ${totalDistinctMatches} partidas únicas, mas nenhuma teve 2+ jogadores do banco simultaneamente.`);
    }

    for (const mid of jointMatches) {
        const involvedTags = matchToTags[mid];
        
        // 4. Inserir na fila de análise para CADA jogador do grupo
        console.log(`📥 Adicionando partida ${mid} à fila para ${involvedTags.length} agente(s).`);
        
        for (const tag of involvedTags) {
            // Verificar se estE jogador específico já foi agendado para esta partida
            const { data: existing, error: checkError } = await supabase
                .from('match_analysis_queue')
                .select('id')
                .eq('match_id', mid)
                .eq('agente_tag', tag);

            if (checkError) {
                console.error(`⚠️ Erro ao verificar duplicata para jogador ${tag} na partida ${mid}:`, checkError.message);
                continue;
            }

            if (existing && existing.length > 0) {
                console.log(`⏭️ Jogador ${tag} já registrado para partida ${mid}. Pulando.`);
                continue;
            }

            const { error: insError } = await supabase.from('match_analysis_queue').insert([{
                match_id: mid,
                agente_tag: tag, 
                status: 'pending',
                metadata: {
                    group: involvedTags,
                    count: involvedTags.length,
                    discovered_by: 'radar'
                }
            }]);

            if (insError) {
                console.error(`❌ FALHA ao inserir jogador ${tag} na partida ${mid}:`, insError.message);
            } else {
                console.log(`✅ Jogador ${tag} agendado para partida ${mid}.`);
            }
        }
    }

    console.log("✅ [RADAR] Varredura concluída.");
}

discover();
