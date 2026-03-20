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
    document.getElementById('resAgent').textContent = data.agent;
    document.getElementById('resMap').textContent = data.map;
    document.getElementById('resPerformance').textContent = data.performance_vs_meta;
    document.getElementById('resKdDetail').textContent = `K/D: ${data.kd.toFixed(2)} | BASE: ${data.meta_kd.toFixed(2)}`;
    document.getElementById('resCombat').textContent = `${data.acs.toFixed(0)} ACS / ${data.adr.toFixed(0)} ADR`;

    const timeline = document.getElementById('roundTimeline');
    timeline.innerHTML = '';

    data.rounds.forEach(r => {
        const item = document.createElement('div');
        item.className = 'round-item';
        
        let feedbackContent = '';
        if (r.pos) feedbackContent += `<div class="pos">>> ${r.pos}</div>`;
        if (r.neg) feedbackContent += `<div class="neg">>> ${r.neg}</div>`;
        if (!r.pos && !r.neg) feedbackContent += `<div class="neutral">NO_CRITICAL_EVENTS_RECORDED</div>`;

        item.innerHTML = `
            <div class="round-number">${r.round.toString().padStart(2, '0')}</div>
            <div class="feedback-list">
                ${feedbackContent}
            </div>
        `;
        timeline.appendChild(item);
    });

    resultsSec.classList.remove('hidden');
    resultsSec.scrollIntoView({ behavior: 'smooth' });
}
