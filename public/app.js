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
    document.getElementById('resPerformance').innerHTML = `<b>${data.performance_vs_meta.toUpperCase()}</b>`;
    document.getElementById('resKdDetail').textContent = `K/D_ACTUAL: ${data.kd.toFixed(2)} // TARGET: ${data.meta_kd.toFixed(2)}`;
    document.getElementById('resCombat').innerHTML = `<b>${data.acs.toFixed(0)}</b> ACS // <b>${data.adr.toFixed(0)}</b> ADR`;

    const timeline = document.getElementById('roundTimeline');
    timeline.innerHTML = '';

    data.rounds.forEach(r => {
        const item = document.createElement('div');
        item.className = 'round-item';
        
        let feedbackContent = '';
        if (r.pos) feedbackContent += `<div class="feedback-line pos">[>>] ${r.pos.toUpperCase()}</div>`;
        if (r.neg) feedbackContent += `<div class="feedback-line neg">[!!] ${r.neg.toUpperCase()}</div>`;
        if (!r.pos && !r.neg) feedbackContent += `<div class="feedback-line neutral">[..] PASSIVE_ENGAGEMENT_DETECTED</div>`;

        item.innerHTML = `
            <div class="round-id">ROUND_IDENTIFIER::${r.round.toString().padStart(2, '0')}</div>
            <div class="feedback-list">
                ${feedbackContent}
                <div class="explanation-line">LOG_REASONING: ${r.explanation.toUpperCase()}</div>
            </div>
        `;
        timeline.appendChild(item);
    });

    resultsSec.classList.remove('hidden');
    resultsSec.scrollIntoView({ behavior: 'smooth' });
}
