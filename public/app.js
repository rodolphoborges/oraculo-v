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
    document.getElementById('resAgent').innerHTML = `<b>${data.agent.toUpperCase()}</b>`;
    document.getElementById('resMap').innerHTML = `<b>${data.map.toUpperCase()}</b>`;
    const perfStatus = data.performance_status === 'ABOVE_BASELINE' ? 'ACIMA DA MÉDIA' : 'ABAIXO DA MÉDIA';
    const perfColor = data.performance_status === 'ABOVE_BASELINE' ? 'var(--term-green)' : 'var(--term-red)';
    
    document.getElementById('resPerformance').innerHTML = `<span style="color: ${perfColor}">[ TAXA: ${data.performance_index}% // SITUAÇÃO: ${perfStatus} // RANKING: ${data.meta_category} ]</span>`;
    document.getElementById('resEstimatedRank').innerHTML = `<span style="border: 1px solid var(--term-green); padding: 0 5px;">[ ${data.estimated_rank} ]</span>`;
    document.getElementById('resKdDetail').textContent = `K/D ATUAL: ${data.kd.toFixed(2)} // ALVO DO RANKING: ${data.target_kd.toFixed(2)}`;
    document.getElementById('resCombat').innerHTML = `<b>${data.acs.toFixed(0)}</b> PONTUAÇÃO (ACS) // <b>${data.adr.toFixed(0)}</b> DANO MÉDIO (ADR)`;

    const timeline = document.getElementById('roundTimeline');
    timeline.innerHTML = '';

    const agents = ["Astra","Breach","Brimstone","Chamber","Cypher","Deadlock","Fade","Gekko","Harbor","Iso","Jett","KAY/O","Killjoy","Neon","Omen","Phoenix","Raze","Reyna","Sage","Skye","Sova","Tejo","Viper","Vyse","Yoru"];
    const highlightAgents = (text) => {
        let h = text;
        agents.forEach(a => { h = h.replace(new RegExp(`\\b${a}\\b`, 'gi'), `<b>$&</b>`); });
        return h;
    };

    data.rounds.forEach(r => {
        const item = document.createElement('div');
        item.className = 'round-item';

        let feedbackContent = '';
        if (r.pos) feedbackContent += `<div class="feedback-line pos">[OK] ${highlightAgents(r.pos.toUpperCase())}</div>`;
        if (r.neg) feedbackContent += `<div class="feedback-line neg">[!!] ${highlightAgents(r.neg.toUpperCase())}</div>`;
        if (!r.pos && !r.neg) feedbackContent += `<div class="feedback-line neutral">[--] SEM EVENTOS REGISTRADOS</div>`;

        // Renderização do Mapa Tático se houver eventos
        let tacticalMapHtml = '';
        if (r.tactical_events && r.tactical_events.length > 0 && data.map_details.xMultiplier) {
            const mapInfo = data.map_details;

            // Helper: constrói o HTML de um marcador com ícone do agente
            const makeMarker = (pos, radiansVal, agentName, role, isPlayer) => {
                if (!pos) return '';
                const mx = (pos.y * mapInfo.xMultiplier + mapInfo.xScalarToAdd) * 100;
                const my = (pos.x * mapInfo.yMultiplier + mapInfo.yScalarToAdd) * 100;

                const agentSlug = agentName.toLowerCase().replace(/[^a-z]/g, '');
                const uuid = agentIconMap[agentSlug];
                const iconUrl = uuid
                    ? `https://media.valorant-api.com/agents/${uuid}/displayiconsmall.png`
                    : '';
                const initials = agentName.slice(0, 2).toUpperCase();
                const tooltip = isPlayer ? `${agentName.toUpperCase()} (VOCÊ)` : agentName.toUpperCase();

                // Só renderiza cone e mira se o ângulo for válido
                const hasAngle = (radiansVal !== null && radiansVal !== undefined && !isNaN(radiansVal));
                const deg = hasAngle ? (radiansVal * (180 / Math.PI) - 90) : 0;
                const coneHtml = hasAngle
                    ? `<div class="vision-cone" style="transform:rotate(${deg}deg)"></div>
                       <div class="aim-point" style="transform:translate(-50%,-50%) rotate(${deg}deg) translateY(-30px)"></div>`
                    : '';

                return `
                    <div class="map-point ${role} ${isPlayer ? 'player' : ''}" style="left:${mx}%;top:${my}%">
                        ${iconUrl
                            ? `<img class="agent-icon" src="${iconUrl}"
                                 onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
                                 alt="${agentName}">`
                            : ''
                        }
                        <span class="agent-initials" style="display:${iconUrl ? 'none' : 'flex'}">${initials}</span>
                        <div class="map-label">${tooltip}</div>
                        ${coneHtml}
                    </div>
                `;
            };

            tacticalMapHtml = `
                <div class="tactical-container">
                    <div class="round-id">MAPA_TÁTICO // RD_${r.round}</div>
                    <div class="tactical-map">
                        <img src="${mapInfo.imageUrl}" class="map-bg">
                        ${r.tactical_events.map(ev =>
                            makeMarker(ev.killer_pos, ev.killer_radians, ev.killer_agent, 'killer', ev.is_player_killer) +
                            makeMarker(ev.victim_pos, ev.victim_radians, ev.victim_agent, 'victim', ev.is_player_victim)
                        ).join('')}
                    </div>
                    <div class="map-legend">
                        <div class="map-legend-item"><div class="legend-dot killer"></div> MATADOR</div>
                        <div class="map-legend-item"><div class="legend-dot victim"></div> VÍTIMA</div>
                        <div class="map-legend-item"><div class="legend-dot aim"></div> MIRA</div>
                        <div class="map-legend-item" style="opacity:0.5">[ HOVER → AGENTE ]</div>
                    </div>
                </div>
            `;
        }

        // Extração de metadados do primeiro evento tático relevante
        let roundSubHeader = '';
        if (r.tactical_events && r.tactical_events.length > 0) {
            const mainEvent = r.tactical_events[0];
            roundSubHeader = ` // ${mainEvent.time} // ${mainEvent.weapon.toUpperCase()}`;
        }

        item.innerHTML = `
            <div class="round-id">RD_${r.round.toString().padStart(2, '0')}${roundSubHeader}</div>
            <div class="feedback-list">
                ${feedbackContent}
                <div class="explanation-line">REGISTRO_DE_ANÁLISE: ${highlightAgents(r.explanation.toUpperCase())}</div>
            </div>
            ${tacticalMapHtml}
        `;
        timeline.appendChild(item);
    });

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
