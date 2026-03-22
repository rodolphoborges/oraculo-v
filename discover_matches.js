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
            const url = `https://api.henrikdev.xyz/valorant/v3/matches/br/${encodeURIComponent(name)}/${encodeURIComponent(tag)}?size=3`;
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

            for (const match of json.data) {
                const mid = match.metadata.matchid;
                if (!matchHistory[mid]) {
                    matchHistory[mid] = new Set();
                    matchToTags[mid] = [];
                }
                matchHistory[mid].add(p.riot_id);
                matchToTags[mid].push(p.riot_id);
            }
        } catch (err) {
            console.error(`🔥 Erro ao processar ${p.riot_id}:`, err.message);
        }

        // Delay anti-ban para a API gratuita do Henrik (~1s entre requisições)
        await delay(1200);
    }

    // 3. Filtrar partidas com INTERSEÇÃO (2+ jogadores cadastrados)
    const jointMatches = Object.keys(matchHistory).filter(mid => matchHistory[mid].size >= 2);
    console.log(`🎯 Encontradas ${jointMatches.length} partidas em grupo potenciais.`);

    for (const mid of jointMatches) {
        const involvedTags = matchToTags[mid];
        
        // Verificar se essa partida já foi analisada ou está na fila (independente do status)
        const { data: existing } = await supabase
            .from('match_analysis_queue')
            .select('id')
            .eq('match_id', mid)
            .limit(1);

        if (existing && existing.length > 0) {
            console.log(`⏭️ Partida ${mid} já registrada no sistema. Pulando.`);
            continue;
        }

        // 4. Inserir na fila de análise
        // Usamos a tag do primeiro jogador para a análise base (o script Python cuida do resto)
        // Guardamos todos os envolvidos no metadata
        console.log(`📥 Adicionando partida ${mid} à fila de análise.`);
        await supabase.from('match_analysis_queue').insert([{
            match_id: mid,
            player_tag: involvedTags[0], 
            status: 'pending',
            metadata: {
                group: involvedTags,
                count: involvedTags.length
            }
        }]);
    }

    console.log("✅ [RADAR] Varredura concluída.");
}

discover();
