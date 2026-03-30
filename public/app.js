const analyzeBtn = document.getElementById('analyzeBtn');
const playerInp = document.getElementById('playerTag');
const matchInp = document.getElementById('matchId');
const loadingSec = document.getElementById('loading');
const resultsSec = document.getElementById('results');

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
    } catch (_) {}
})();

function addTerminalMessage(msg, type = 'info') {
    const p = document.createElement('p');
    p.innerHTML = `> [ ${msg} ] <span class="loading-cursor"></span>`;
    if (type === 'error') p.style.color = 'var(--red)';
    loadingSec.appendChild(p);
    loadingSec.scrollTop = loadingSec.scrollHeight;
}

async function startAnalysisFlow(player, matchId) {
    if (!player || !matchId) return;

    loadingSec.classList.remove('hidden');
    resultsSec.classList.add('hidden');
    analyzeBtn.disabled = true;
    loadingSec.innerHTML = ''; // Limpa logs anteriores

    try {
        addTerminalMessage('ENFILEIRANDO_ANÁLISE_NA_NUVEM...');
        const queueRes = await fetch('/api/queue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                player_id: player, 
                match_id: matchId 
            })
        });
        const queueData = await queueRes.json();
        if (!queueRes.ok) throw new Error(queueData.error);

        addTerminalMessage('AGUARDANDO_PROCESSAMENTO_NA_FILA...');

        const pollStatus = async () => {
            const statusRes = await fetch(`/api/status/${matchId}?player=${encodeURIComponent(player)}`);
            
            // Se for 404, significa que ainda está na fila ou processando
            if (statusRes.status === 404) return false; 
            
            const statusData = await statusRes.json();
            if (!statusRes.ok) throw new Error(statusData.error || 'ERRO_DE_PROCESSAMENTO');

            if (statusData.status === 'completed' && statusData.result) {
                addTerminalMessage('ANÁLISE_CONCLUÍDA_COM_SUCESSO.');
                renderResults(statusData.result);
                return true;
            } else if (statusData.status === 'failed') {
                throw new Error(statusData.error || 'Falha no processamento.');
            } else if (statusData.status === 'processing') {
                // Evita duplicar a mensagem de processamento se já estiver lá
                if (!loadingSec.innerText.includes('MOTOR_DE_ANÁLISE_EM_EXECUÇÃO')) {
                    addTerminalMessage('MOTOR_DE_ANÁLISE_EM_EXECUÇÃO...');
                }
            }
            return false;
        };

        const timer = setInterval(async () => {
            try {
                const finished = await pollStatus();
                if (finished) {
                    clearInterval(timer);
                    loadingSec.classList.add('hidden');
                    analyzeBtn.disabled = false;
                }
            } catch (err) {
                clearInterval(timer);
                addTerminalMessage('ERRO: ' + err.message, 'error');
                analyzeBtn.disabled = false;
            }
        }, 3000);

        // Primeira tentativa imediata
        const finished = await pollStatus();
        if (finished) {
            loadingSec.classList.add('hidden');
            analyzeBtn.disabled = false;
        }

    } catch (err) {
        addTerminalMessage('ERRO_AO_INICIAR: ' + err.message, 'error');
        analyzeBtn.disabled = false;
    }
}

analyzeBtn.addEventListener('click', () => {
    startAnalysisFlow(playerInp.value.trim(), matchInp.value.trim());
});

// Deep Links logic
window.addEventListener('load', () => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('player');
    const m = params.get('matchId');
    if (p && m) {
        // Modo Orgânico: Esconde inputs e simula comando digitado
        const cmdInput = document.querySelector('.cmd-input');
        if (cmdInput) cmdInput.style.display = 'none';

        playerInp.value = p;
        matchInp.value = m;

        loadingSec.innerHTML = '';
        loadingSec.classList.remove('hidden');
        
        const cmdLog = document.createElement('p');
        cmdLog.innerHTML = `<span style="color:var(--green-ok)">> analyze --player "${p}" --match ${m}</span>`;
        loadingSec.appendChild(cmdLog);

        setTimeout(() => startAnalysisFlow(p, m), 1000);
    }
});

function renderResults(data) {
    document.getElementById('resAgent').innerHTML = `<b>${data.agent.toUpperCase()}</b>`;
    document.getElementById('resMap').innerHTML   = `<b>${data.map.toUpperCase()}</b>`;
    const above = data.performance_index >= 100;
    const perfColor = above ? 'var(--green-ok)' : 'var(--red)';
    const perfLabel = above ? 'ACIMA DA MÉDIA' : 'ABAIXO DA MÉDIA';
    document.getElementById('resPerformance').innerHTML =
        `<span style="color:${perfColor}">[ TAXA: ${data.performance_index}% // ${perfLabel} // ${data.meta_category} ]</span>`;
    document.getElementById('resEstimatedRank').innerHTML =
        `<span style="border:1px solid var(--green-ok);padding:0 6px">[ ${data.estimated_rank} ]</span>`;
    document.getElementById('resKdDetail').textContent =
        `K/D: ${data.kd.toFixed(2)}  //  ALVO: ${data.target_kd.toFixed(2)}`;
    document.getElementById('resFirstBloods').innerHTML =
        `<b>${data.first_kills || 0}</b> FB (ABERTURAS)`;
    document.getElementById('resCombat').innerHTML =
        `<b>${data.acs.toFixed(0)}</b> ACS  //  <b>${data.adr.toFixed(0)}</b> ADR`;
    
    const adviceText = data.conselho_kaio;
    const adviceEl = document.getElementById('resAdviceText');
    const adviceBlock = document.getElementById('resAdvice');
    
    if (adviceText) {
        if (typeof adviceText === 'object') {
            adviceEl.textContent = (adviceText.diagnostico_principal || 'ANÁLISE_CONCLUÍDA').toUpperCase();
            
            const renderList = (id, listId, items) => {
                const block = document.getElementById(id);
                const list = document.getElementById(listId);
                list.innerHTML = '';
                if (items && Array.isArray(items) && items.length > 0) {
                    items.forEach(i => {
                        const li = document.createElement('li');
                        li.textContent = i.toUpperCase();
                        list.appendChild(li);
                    });
                    block.classList.remove('hidden');
                } else {
                    block.classList.add('hidden');
                }
            };

            renderList('resStrength', 'resStrengthList', adviceText.pontos_fortes);
            renderList('resWeakness', 'resWeaknessList', adviceText.pontos_fracos);
        } else {
            adviceEl.textContent = adviceText.toUpperCase();
            document.getElementById('resStrength').classList.add('hidden');
            document.getElementById('resWeakness').classList.add('hidden');
        }
        adviceBlock.classList.remove('hidden');
    } else {
        adviceBlock.classList.add('hidden');
        document.getElementById('resStrength').classList.add('hidden');
        document.getElementById('resWeakness').classList.add('hidden');
    }

    // ── Helpers ──────────────────────────────────────────────
    const AGENTS = ["Astra","Breach","Brimstone","Chamber","Cypher","Deadlock","Fade","Gekko","Harbor","Iso","Jett","KAY/O","Killjoy","Neon","Omen","Phoenix","Raze","Reyna","Sage","Skye","Sova","Tejo","Viper","Vyse","Yoru"];
    const hi = t => {
        let h = t;
        AGENTS.forEach(a => { h = h.replace(new RegExp(`\\b${a}\\b`, 'gi'), '<b>$&</b>'); });
        return h;
    };

    const makeMarker = (mi, pos, rad, agent, role, isPlayer, seq, animClass) => {
        if (!pos) return '';
        const mx = (pos.y * mi.xMultiplier + mi.xScalarToAdd) * 100;
        const my = (pos.x * mi.yMultiplier + mi.yScalarToAdd) * 100;
        const slug = agent.toLowerCase().replace(/[^a-z]/g, '');
        const uuid = agentIconMap[slug];
        const iconUrl = uuid ? `https://media.valorant-api.com/agents/${uuid}/displayiconsmall.png` : '';
        const initials = agent.slice(0, 2).toUpperCase();
        const seqLabel = seq != null ? `#${seq}` : '';
        const tooltip  = isPlayer
            ? `${seqLabel} ${agent.toUpperCase()} (VOCÊ)`
            : `${seqLabel} ${agent.toUpperCase()}`;
        const ok = rad !== null && rad !== undefined && !isNaN(rad);
        const deg = ok ? (rad * (180 / Math.PI) - 90) : 0;
        const cone = ok
            ? `<div class="vision-cone" style="transform:rotate(${deg}deg)"></div>
               ${isPlayer ? `<div class="aim-point" style="transform:translate(-50%,-50%) rotate(${deg}deg) translateY(-30px)"></div>` : ''}`
            : '';
        const seqBadge = seq != null ? `<span class="marker-seq">${seq}</span>` : '';
        return `
            <div class="map-point ${role}${isPlayer ? ' player' : ''} ${animClass || ''}" style="left:${mx.toFixed(2)}%;top:${my.toFixed(2)}%">
                ${iconUrl ? `<img class="agent-icon" src="${iconUrl}"
                    onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" alt="${agent}">` : ''}
                <span class="agent-initials" style="display:${iconUrl ? 'none' : 'flex'}">${initials}</span>
                ${seqBadge}
                <div class="map-label">${tooltip}</div>
                ${cone}
            </div>`;
    };

    const buildDetail = r => {
        const mi = data.map_details;
        let mapHtml = '';
        if (r.tactical_events?.length && mi?.xMultiplier) {
            // Calcular centro dos eventos para zoom
            let sumX = 0, sumY = 0, count = 0;
            r.tactical_events.forEach(ev => {
                if (ev.killer_pos) { sumX += ev.killer_pos.y * mi.xMultiplier + mi.xScalarToAdd; sumY += ev.killer_pos.x * mi.yMultiplier + mi.yScalarToAdd; count++; }
                if (ev.victim_pos) { sumX += ev.victim_pos.y * mi.xMultiplier + mi.xScalarToAdd; sumY += ev.victim_pos.x * mi.yMultiplier + mi.yScalarToAdd; count++; }
            });
            const avgX = count > 0 ? (sumX / count) * 100 : 50;
            const avgY = count > 0 ? (sumY / count) * 100 : 50;
            const zoom = 2.5;
            const transform = `scale(${zoom}) translate(${(50 - avgX).toFixed(2)}%, ${(50 - avgY).toFixed(2)}%)`;

            // ── Timing de cada evento (comprimido para janela legível) ──
            const times = r.tactical_events.map(ev => ev.time_ms || 0);
            const minT  = Math.min(...times);
            const maxT  = Math.max(...times);
            const span  = maxT - minT || 1;
            const n     = r.tactical_events.length;
            const ANIM_WINDOW   = Math.max(n * 1.8, 3.0);
            const BASE_DELAY    = 0.4;
            const VICTIM_OFFSET = 0.35;
            const eventDelays = r.tactical_events.map(ev => {
                const norm = (ev.time_ms - minT) / span;
                const kd   = BASE_DELAY + norm * ANIM_WINDOW;
                return { kd, vd: kd + VICTIM_OFFSET };
            });

            // ── Gerar keyframes únicos por round para permitir loop infinito ──
            // O delay é codificado dentro do keyframe (não via animation-delay,
            // que só aplica na 1ª iteração com infinite).
            const KDUR = 0.6;
            const VDUR = 1.6;
            const lastVD    = Math.max(...eventDelays.map(d => d.vd));
            const totalCycle = lastVD + VDUR + 1.0; // + pausa antes do loop
            const tc = totalCycle.toFixed(2);
            const uid = `rd${r.round}`;
            const p = (t) => (t / totalCycle * 100).toFixed(2); // % dentro do ciclo

            let styleRules = '';
            const markersHtml = r.tactical_events.map((ev, i) => {
                const { kd, vd } = eventDelays[i];
                const ka = `k${uid}e${i}`;
                const va = `v${uid}e${i}`;

                // Killer desaparece ANTES do próximo evento começar (mira e posição limpas)
                const nextKd     = i < n - 1 ? eventDelays[i + 1].kd : totalCycle - 0.4;
                const kFadeStart = Math.max(kd + KDUR, nextKd - 0.25);
                const kFadeEnd   = nextKd;

                styleRules += `
                @keyframes ${ka} {
                    0%,${p(kd)}%               { opacity:0; transform:translate(-50%,-50%) scale(.12); filter:brightness(8); }
                    ${p(kd+KDUR*.55)}%         { opacity:1; transform:translate(-50%,-50%) scale(1.28); filter:brightness(2.5); }
                    ${p(kd+KDUR)}%,${p(kFadeStart)}% { opacity:1; transform:translate(-50%,-50%) scale(1); filter:brightness(1); }
                    ${p(kFadeEnd)}%,100%        { opacity:0; transform:translate(-50%,-50%) scale(.6); filter:brightness(1); }
                }
                .${ka} { animation:${ka} ${tc}s linear 0s infinite; }`;

                // Vítima: aparece com flash vermelho, encolhe e desaparece
                // Some completamente no final do ciclo (opacity 0 em 100% para loop limpo)
                const vFadeEnd = Math.min(vd + VDUR, nextKd - 0.1);
                styleRules += `
                @keyframes ${va} {
                    0%,${p(vd)}%           { opacity:0; transform:translate(-50%,-50%) scale(.12); filter:brightness(8); }
                    ${p(vd+VDUR*.20)}%     { opacity:1; transform:translate(-50%,-50%) scale(1.35); filter:brightness(3) saturate(2); }
                    ${p(vd+VDUR*.45)}%     { opacity:1; transform:translate(-50%,-50%) scale(1);    filter:brightness(1); }
                    ${p(vFadeEnd)}%        { opacity:.10; transform:translate(-50%,-50%) scale(.45); filter:grayscale(1) brightness(.2); }
                    100%                   { opacity:0;   transform:translate(-50%,-50%) scale(.45); filter:grayscale(1) brightness(.2); }
                }
                .${va} { animation:${va} ${tc}s linear 0s infinite; }`;

                return makeMarker(mi, ev.killer_pos, ev.killer_radians, ev.killer_agent, 'killer', ev.is_player_killer, i+1, ka) +
                       makeMarker(mi, ev.victim_pos, ev.victim_radians, ev.victim_agent, 'victim', ev.is_player_victim, i+1, va);
            }).join('');

            mapHtml = `
                <style>${styleRules}</style>
                <div class="tactical-container">
                    <div class="tactical-map">
                        <div class="map-zoom-layer" style="transform: ${transform}">
                            <img src="${mi.imageUrl}" class="map-bg">
                            ${markersHtml}
                        </div>
                    </div>
                    <div class="map-legend">
                        <div class="map-legend-item"><div class="legend-dot killer"></div> MATADOR</div>
                        <div class="map-legend-item"><div class="legend-dot victim"></div> VÍTIMA</div>
                        <div class="map-legend-item"><div class="legend-dot aim"></div> MIRA</div>
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
        const snap = r.comment || (r.narrative?.[0]?.text) || 'SEM EVENTOS';
        const cls  = r.impacto === 'Positivo' ? 'pos' : r.impacto === 'Negativo' ? 'neg' : 'neutral';
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
            const isOpen = item.classList.contains('open');
            item.classList.toggle('open');
            if (!isOpen && !built) {
                // Abrindo: constrói e dispara a animação
                built = true;
                item.querySelector('.round-detail').innerHTML = buildDetail(r);
            } else if (isOpen) {
                // Fechando: reseta para replay na próxima abertura
                built = false;
                item.querySelector('.round-detail').innerHTML = '';
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
