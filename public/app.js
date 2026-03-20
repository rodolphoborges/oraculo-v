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
    const perfStatus = data.performance_status === 'ABOVE_BASELINE' ? 'ACIMA DA MÉDIA' : 'ABAIXO DA MÉDIA';
    const perfColor = data.performance_status === 'ABOVE_BASELINE' ? 'var(--term-green)' : 'var(--term-red)';
    
    document.getElementById('resPerformance').innerHTML = `<span style="color: ${perfColor}">[ TAXA: ${data.performance_index}% // SITUAÇÃO: ${perfStatus} // RANKING: ${data.meta_category} ]</span>`;
    document.getElementById('resEstimatedRank').innerHTML = `<span style="border: 1px solid var(--term-green); padding: 0 5px;">[ ${data.estimated_rank} ]</span>`;
    document.getElementById('resKdDetail').textContent = `K/D ATUAL: ${data.kd.toFixed(2)} // ALVO DO RANKING: ${data.target_kd.toFixed(2)}`;
    document.getElementById('resCombat').innerHTML = `<b>${data.acs.toFixed(0)}</b> PONTUAÇÃO (ACS) // <b>${data.adr.toFixed(0)}</b> DANO MÉDIO (ADR)`;

    const timeline = document.getElementById('roundTimeline');
    timeline.innerHTML = '';

    data.rounds.forEach(r => {
        const item = document.createElement('div');
        item.className = 'round-item';
        
        let feedbackContent = '';
        if (r.pos) feedbackContent += `<div class="feedback-line pos">[OK] ${r.pos.toUpperCase()}</div>`;
        if (r.neg) feedbackContent += `<div class="feedback-line neg">[!!] ${r.neg.toUpperCase()}</div>`;
        if (!r.pos && !r.neg) feedbackContent += `<div class="feedback-line neutral">[--] SEM EVENTOS REGISTRADOS</div>`;

        // Renderização do Mapa Tático se houver eventos
        let tacticalMapHtml = '';
        if (r.tactical_events && r.tactical_events.length > 0 && data.map_details.xMultiplier) {
            const mapInfo = data.map_details;
            tacticalMapHtml = `
                <div class="tactical-container">
                    <div class="round-id" style="margin-bottom: 5px;">MAPA_TÁTICO // RD_${r.round}</div>
                    <div class="tactical-map">
                        <img src="${mapInfo.imageUrl}" class="map-bg">
                        ${r.tactical_events.map(ev => {
                            let eventHtml = '';
                            
                            if (ev.killer_pos) {
                                const kx = (ev.killer_pos.y * mapInfo.xMultiplier + mapInfo.xScalarToAdd) * 100;
                                const ky = (ev.killer_pos.x * mapInfo.yMultiplier + mapInfo.yScalarToAdd) * 100;
                                eventHtml += `
                                    <div class="map-point killer" style="left: ${kx}%; top: ${ky}%">
                                        <div class="vision-cone" style="transform: rotate(${ev.killer_radians * (180 / Math.PI) - 90}deg)">
                                            <div class="aim-point"></div>
                                        </div>
                                        <div class="map-label">${ev.is_player_killer ? `${ev.killer_agent.toUpperCase()} (VOCÊ)` : ev.killer_agent.toUpperCase()}</div>
                                    </div>
                                `;
                            }
                            
                            if (ev.victim_pos) {
                                const vx = (ev.victim_pos.y * mapInfo.xMultiplier + mapInfo.xScalarToAdd) * 100;
                                const vy = (ev.victim_pos.x * mapInfo.yMultiplier + mapInfo.yScalarToAdd) * 100;
                                eventHtml += `
                                    <div class="map-point victim" style="left: ${vx}%; top: ${vy}%">
                                        <div class="vision-cone" style="transform: rotate(${ev.victim_radians * (180 / Math.PI) - 90}deg)">
                                            <div class="aim-point"></div>
                                        </div>
                                        <div class="map-label">${ev.is_player_victim ? `${ev.victim_agent.toUpperCase()} (VOCÊ)` : ev.victim_agent.toUpperCase()}</div>
                                    </div>
                                `;
                            }
                            
                            return eventHtml;
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
                <div class="explanation-line">REGISTRO_DE_ANÁLISE: ${r.explanation.toUpperCase()}</div>
            </div>
            ${tacticalMapHtml}
        `;
        timeline.appendChild(item);
    });

    resultsSec.classList.remove('hidden');
    resultsSec.scrollIntoView({ behavior: 'smooth' });
}
