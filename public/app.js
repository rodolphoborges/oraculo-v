const analyzeBtn = document.getElementById('analyzeBtn');
const playerInp = document.getElementById('playerTag');
const matchInp = document.getElementById('matchId');
const loadingSec = document.getElementById('loading');
const resultsSec = document.getElementById('results');

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

    try {
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
    const perfStatus = data.performance_status;
    const perfColor = perfStatus === 'ABOVE_BASELINE' ? 'var(--term-green)' : 'var(--term-red)';
    
    document.getElementById('resPerformance').innerHTML = `<span style="color: ${perfColor}">[ RATIO: ${data.performance_index}% // STATUS: ${perfStatus} // META: ${data.meta_category} ]</span>`;
    document.getElementById('resKdDetail').textContent = `K/D_ACTUAL: ${data.kd.toFixed(2)} // META_TARGET: ${data.target_kd.toFixed(2)}`;
    document.getElementById('resCombat').innerHTML = `<b>${data.acs.toFixed(0)}</b> ACS // <b>${data.adr.toFixed(0)}</b> ADR`;

    const timeline = document.getElementById('roundTimeline');
    timeline.innerHTML = '';

    data.rounds.forEach(r => {
        const item = document.createElement('div');
        item.className = 'round-item';
        
        let feedbackContent = '';
        if (r.pos) feedbackContent += `<div class="feedback-line pos">[OK] ${r.pos.toUpperCase()}</div>`;
        if (r.neg) feedbackContent += `<div class="feedback-line neg">[!!] ${r.neg.toUpperCase()}</div>`;
        if (!r.pos && !r.neg) feedbackContent += `<div class="feedback-line neutral">[--] NO_DETECTION</div>`;

        // Renderização do Mapa Tático se houver eventos
        let tacticalMapHtml = '';
        if (r.tactical_events && r.tactical_events.length > 0 && data.map_details.xMultiplier) {
            const mapInfo = data.map_details;
            tacticalMapHtml = `
                <div class="tactical-container">
                    <div class="round-id" style="margin-bottom: 5px;">TACTICAL_GRID // RD_${r.round}</div>
                    <div class="tactical-map">
                        <img src="${mapInfo.imageUrl}" class="map-bg">
                        ${r.tactical_events.map(ev => {
                            // FÓRMULA CORRIGIDA: Valorant Inverte X e Y para exibição no mini-mapa
                            const kx = (ev.killer_pos.y * mapInfo.xMultiplier + mapInfo.xScalarToAdd) * 100;
                            const ky = (ev.killer_pos.x * mapInfo.yMultiplier + mapInfo.yScalarToAdd) * 100;
                            const vx = (ev.victim_pos.y * mapInfo.xMultiplier + mapInfo.xScalarToAdd) * 100;
                            const vy = (ev.victim_pos.x * mapInfo.yMultiplier + mapInfo.yScalarToAdd) * 100;
                            
                            return `
                                <div class="map-point killer" style="left: ${kx}%; top: ${ky}%">
                                    <div class="vision-cone" style="transform: rotate(${ev.killer_radians * (180 / Math.PI) - 90}deg)">
                                        <div class="aim-point"></div>
                                    </div>
                                    <div class="map-label">${ev.is_player_killer ? `${ev.killer_agent.toUpperCase()} (YOU)` : ev.killer_agent.toUpperCase()}</div>
                                </div>
                                <div class="map-point victim" style="left: ${vx}%; top: ${vy}%">
                                    <div class="vision-cone" style="transform: rotate(${ev.victim_radians * (180 / Math.PI) - 90}deg)">
                                        <div class="aim-point"></div>
                                    </div>
                                    <div class="map-label">${ev.is_player_victim ? `${ev.victim_agent.toUpperCase()} (YOU)` : ev.victim_agent.toUpperCase()}</div>
                                </div>
                            `;
                        }).join('')}
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
                <div class="explanation-line">ANALYSIS_LOG: ${r.explanation.toUpperCase()}</div>
            </div>
            ${tacticalMapHtml}
        `;
        timeline.appendChild(item);
    });

    resultsSec.classList.remove('hidden');
    resultsSec.scrollIntoView({ behavior: 'smooth' });
}
