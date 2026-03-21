const analyzeBtn = document.getElementById('analyzeBtn');
const playerInp = document.getElementById('playerTag');
const matchInp = document.getElementById('matchId');
const loadingSec = document.getElementById('loading');
const resultsSec = document.getElementById('results');

// Cache de ícones dos agentes – carregado uma vez ao iniciar a página
// Formato: { "jett": "uuid", "killjoy": "uuid", ... }
let agentIconMap = {};
(async () => {
    try {
        const res = await fetch('https://valorant-api.com/v1/agents?isPlayableCharacter=true');
        const json = await res.json();
        if (json.status === 200) {
            json.data.forEach(a => {
                const key = a.displayName.toLowerCase().replace(/[^a-z]/g, '');
                agentIconMap[key] = a.uuid;
            });
        }
    } catch (_) { /* falha silenciosa — usará iniciais */ }
})();

analyzeBtn.addEventListener('click', async () => {
    const player = playerInp.value.trim();
    const matchId = matchInp.value.trim();

    if (!player || !matchId) {
        alert('Por favor, preencha o Player Tag e o Match ID.');
        return;
    }

    // Reset UI
    loadingSec.classList.remove('hidden');
    resultsSec.classList.add('hidden');
    analyzeBtn.disabled = true;

    const loadingLines = loadingSec.querySelectorAll('p');
    loadingLines[0].innerHTML = '> [ ACESSANDO_SATÉLITE_VSTATS... ] <span class="loading-cursor"></span>';
    
    try {
        setTimeout(() => {
            loadingLines[1].innerHTML = '> [ DECRIPTANDO_DADOS_DE_PARTIDA... ] <span class="loading-cursor"></span>';
        }, 800);

        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ player, matchId })
        });

        const data = await response.json();

        if (response.ok) {
            renderResults(data);
        } else {
            alert('Erro: ' + data.error);
        }
    } catch (err) {
        alert('Erro de conexão com o servidor.');
    } finally {
        loadingSec.classList.add('hidden');
        analyzeBtn.disabled = false;
    }
});

function renderResults(data) {
    // ── Cabeçalho ───────────────────────────────────────────
    document.getElementById('resAgent').innerHTML = `<b>${data.agent.toUpperCase()}</b>`;
    document.getElementById('resMap').innerHTML   = `<b>${data.map.toUpperCase()}</b>`;
    const above = data.performance_status === 'ABOVE_BASELINE';
    const perfColor = above ? 'var(--green-ok)' : 'var(--red)';
    const perfLabel = above ? 'ACIMA DA MÉDIA' : 'ABAIXO DA MÉDIA';
    document.getElementById('resPerformance').innerHTML =
        `<span style="color:${perfColor}">[ TAXA: ${data.performance_index}% // ${perfLabel} // ${data.meta_category} ]</span>`;
    document.getElementById('resEstimatedRank').innerHTML =
        `<span style="border:1px solid var(--green-ok);padding:0 6px">[ ${data.estimated_rank} ]</span>`;
    document.getElementById('resKdDetail').textContent =
        `K/D: ${data.kd.toFixed(2)}  //  ALVO: ${data.target_kd.toFixed(2)}`;
    document.getElementById('resCombat').innerHTML =
        `<b>${data.acs.toFixed(0)}</b> ACS  //  <b>${data.adr.toFixed(0)}</b> ADR`;
    
    // ── Conselho Tático ──────────────────────────────────────
    if (data.conselho_kaio) {
        document.getElementById('resAdviceText').textContent = data.conselho_kaio.toUpperCase();
        document.getElementById('resAdvice').classList.remove('hidden');
    } else {
        document.getElementById('resAdvice').classList.add('hidden');
    }

    // ── Helpers ──────────────────────────────────────────────
    const AGENTS = ["Astra","Breach","Brimstone","Chamber","Cypher","Deadlock","Fade","Gekko","Harbor","Iso","Jett","KAY/O","Killjoy","Neon","Omen","Phoenix","Raze","Reyna","Sage","Skye","Sova","Tejo","Viper","Vyse","Yoru"];
    const hi = t => {
        let h = t;
        AGENTS.forEach(a => { h = h.replace(new RegExp(`\\b${a}\\b`, 'gi'), '<b>$&</b>'); });
        return h;
    };

    const makeMarker = (mi, pos, rad, agent, role, isPlayer) => {
        if (!pos) return '';
        const mx = (pos.y * mi.xMultiplier + mi.xScalarToAdd) * 100;
        const my = (pos.x * mi.yMultiplier + mi.yScalarToAdd) * 100;
        const slug = agent.toLowerCase().replace(/[^a-z]/g, '');
        const uuid = agentIconMap[slug];
        const iconUrl = uuid ? `https://media.valorant-api.com/agents/${uuid}/displayiconsmall.png` : '';
        const initials = agent.slice(0, 2).toUpperCase();
        const tooltip  = isPlayer ? `${agent.toUpperCase()} (VOCÊ)` : agent.toUpperCase();
        const ok = rad !== null && rad !== undefined && !isNaN(rad);
        const deg = ok ? (rad * (180 / Math.PI) - 90) : 0;
        const cone = ok
            ? `<div class="vision-cone" style="transform:rotate(${deg}deg)"></div>
               <div class="aim-point"  style="transform:translate(-50%,-50%) rotate(${deg}deg) translateY(-30px)"></div>`
            : '';
        return `
            <div class="map-point ${role}${isPlayer ? ' player' : ''}" style="left:${mx.toFixed(2)}%;top:${my.toFixed(2)}%">
                ${iconUrl ? `<img class="agent-icon" src="${iconUrl}"
                    onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" alt="${agent}">` : ''}
                <span class="agent-initials" style="display:${iconUrl ? 'none' : 'flex'}">${initials}</span>
                <div class="map-label">${tooltip}</div>
                ${cone}
            </div>`;
    };

    const buildDetail = r => {
        const mi = data.map_details;
        let mapHtml = '';
        if (r.tactical_events?.length && mi?.xMultiplier) {
            mapHtml = `
                <div class="tactical-container">
                    <div class="tactical-map">
                        <img src="${mi.imageUrl}" class="map-bg">
                        ${r.tactical_events.map(ev =>
                            makeMarker(mi, ev.killer_pos, ev.killer_radians, ev.killer_agent, 'killer', ev.is_player_killer) +
                            makeMarker(mi, ev.victim_pos, ev.victim_radians, ev.victim_agent, 'victim', ev.is_player_victim)
                        ).join('')}
                    </div>
                    <div class="map-legend">
                        <div class="map-legend-item"><div class="legend-dot killer"></div> MATADOR</div>
                        <div class="map-legend-item"><div class="legend-dot victim"></div> VÍTIMA</div>
                        <div class="map-legend-item"><div class="legend-dot aim"></div> MIRA</div>
                        <div class="map-legend-item" style="opacity:0.4">[ HOVER — AGENTE ]</div>
                    </div>
                </div>`;
        }

        const narrativeHtml = r.narrative?.length ? `
            <div class="narrative-timeline">
                ${r.narrative.map(ev => `
                    <div class="narrative-event ${ev.type}">
                        <span class="event-time">${ev.time}</span>
                        <span class="event-text">${hi(ev.text.toUpperCase())}</span>
                    </div>
                `).join('')}
            </div>
        ` : '<div class="explanation-line">ROUND DE BAIXA ATIVIDADE DIRETA.</div>';

        return narrativeHtml + mapHtml;
    };

    // ── Accordion ────────────────────────────────────────────
    const timeline = document.getElementById('roundTimeline');
    timeline.innerHTML = '';

    data.rounds.forEach(r => {
        const item = document.createElement('div');
        item.className = 'round-item';

        const ev0  = r.tactical_events?.[0];
        const sub  = ev0 ? ` · ${ev0.time} · ${ev0.weapon.toUpperCase()}` : '';
        const snap = r.pos || r.neg || 'SEM EVENTOS';
        const cls  = r.pos ? 'pos' : r.neg ? 'neg' : 'neutral';
        const rd   = r.round.toString().padStart(2, '0');

        item.innerHTML = `
            <div class="round-summary">
                <span class="rd-num">RD_${rd}</span>
                <span class="rd-outcome ${cls}">${snap}${sub}</span>
                <span class="rd-chevron">▶</span>
            </div>
            <div class="round-detail"></div>`;

        let built = false;
        item.querySelector('.round-summary').addEventListener('click', () => {
            item.classList.toggle('open');
            if (item.classList.contains('open') && !built) {
                built = true;
                item.querySelector('.round-detail').innerHTML = buildDetail(r);
            }
        });

        timeline.appendChild(item);
    });

    // -- Exibe --------------------------------------------------
    resultsSec.classList.remove('hidden');
    resultsSec.scrollIntoView({ behavior: 'smooth' });

    // Efeito de digitação suave para o cabeçalho do relatório
    const header = document.querySelector('.terminal-header');
    if (header) {
        header.style.width = '0';
        header.classList.add('typing');
        setTimeout(() => {
            header.style.width = 'auto';
            header.style.borderRight = 'none';
        }, 1500);
    }
}
