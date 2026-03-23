// portal.js
let db = {};

async function init() {
    try {
        // Agora usamos a variável global ORACULO_DATABASE carregada via script
        db = typeof ORACULO_DATABASE !== 'undefined' ? ORACULO_DATABASE : {};
        
        if (Object.keys(db).length === 0) {
            throw new Error("Base de dados vazia ou não carregada.");
        }

        renderPlayerList();
        
        // Auto-select first player if exists
        const firstPlayer = Object.keys(db).sort()[0];
        if (firstPlayer) selectPlayer(firstPlayer);
        
    } catch (err) {
        console.error("Erro ao carregar banco de dados estático:", err);
        document.getElementById('match-grid').innerHTML = `
            <div style="padding: 2rem; background: rgba(255,70,85,0.1); border-radius: 12px; border: 1px solid var(--accent-color);">
                <h3 style="color: var(--accent-color); margin-bottom: 1rem;">Erro de Carregamento</h3>
                <p>Não foi possível encontrar a variável <b>ORACULO_DATABASE</b>.</p>
                <p style="margin-top: 1rem; font-size: 0.9rem; color: var(--text-secondary);">
                    Certifique-se de ter rodado <code>node export_static.js</code> e que o arquivo <b>data.js</b> está na mesma pasta que este HTML.
                </p>
            </div>
        `;
    }
}

function renderPlayerList() {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    
    Object.keys(db).sort().forEach(playerTag => {
        const item = document.createElement('div');
        item.className = 'player-item';
        item.id = `player-${playerTag.replace('#', '-')}`;
        item.onclick = () => selectPlayer(playerTag);
        
        item.innerHTML = `
            <span class="player-name">${playerTag}</span>
            <span class="match-count">${db[playerTag].matches.length}</span>
        `;
        list.appendChild(item);
    });
}

function selectPlayer(tag) {
    // UI Update
    document.querySelectorAll('.player-item').forEach(el => el.classList.remove('active'));
    const item = document.getElementById(`player-${tag.replace('#', '-')}`);
    if (item) item.classList.add('active');
    
    document.getElementById('view-title').textContent = `Agente: ${tag}`;
    
    renderMatches(tag);
}

function renderMatches(tag) {
    const grid = document.getElementById('match-grid');
    grid.innerHTML = '';
    
    const matches = db[tag].matches;
    
    matches.forEach(m => {
        const card = document.createElement('div');
        card.className = 'match-card';
        card.onclick = () => showReport(m);
        
        const date = new Date(m.timestamp).toLocaleString('pt-BR');
        const data = m.analysis;
        
        const statusClass = getStatusClass(data.performance_status);
        
        card.innerHTML = `
            <div class="date">${date}</div>
            <div class="agent-map">${data.agent} @ ${data.map}</div>
            <div style="font-size: 1.2rem; font-weight: 800; color: var(--accent-color); margin-bottom: 0.5rem;">
                IK: ${data.performance_index}
            </div>
            <div class="tag-row">
                <span class="status-tag ${statusClass}">${data.performance_status || 'ANALISADO'}</span>
                <span style="font-size: 0.7rem; color: var(--text-secondary)">${data.matches_analyzed || 0} PARTIDAS ANTES</span>
            </div>
        `;
        grid.appendChild(card);
    });
}

function getStatusClass(status) {
    if (!status) return '';
    if (status.includes('ELITE')) return 'status-elite';
    if (status.includes('DENTRO')) return 'status-stable';
    if (status.includes('ABAIXO')) return 'status-danger';
    return '';
}

function showReport(match) {
    const overlay = document.getElementById('report-overlay');
    const content = document.getElementById('report-content');
    const data = match.analysis;
    
    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    content.innerHTML = `
        <div class="report-header">
            <p style="color: var(--accent-color); font-weight: 800; letter-spacing: 2px;">PROTOCOLO V // RELATÓRIO TÁTICO</p>
            <h2>${data.performance_status || 'RELATÓRIO DE CAMPO'}</h2>
            <p style="color: var(--text-secondary)">Operação: ${match.matchId}</p>
        </div>

        <div class="report-stats">
            <div class="stat-box">
                <div class="stat-label">IK (INDEX)</div>
                <div class="stat-value">${data.performance_index}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">ADR</div>
                <div class="stat-value">${data.adr}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">FIRST KILLS (FK)</div>
                <div class="stat-value">${data.first_kills || 0}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">FIRST DEATHS (FD)</div>
                <div class="stat-value">${data.first_deaths || 0}</div>
            </div>
        </div>

        <div class="advice-section">
            <h3 style="margin-bottom: 1rem; color: var(--accent-color);">CONSELHO DO K.A.I.O.</h3>
            <p style="font-size: 1.1rem; line-height: 1.6;">${data.conselho_kaio}</p>
        </div>

        <div class="rounds-analysis">
            <h3 style="margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">ANÁLISE DE ROUNDS</h3>
            ${data.rounds.map(r => `
                <div class="round-item">
                    <div class="round-num">R${String(r.round).padStart(2, '0')}</div>
                    <div class="round-comment">${r.comment}</div>
                    <div class="round-impact ${getImpactClass(r.impacto)}">${r.impacto.toUpperCase()}</div>
                </div>
            `).join('')}
        </div>
    `;
}

function getImpactClass(impact) {
    if (impact === 'Positivo') return 'impact-pos';
    if (impact === 'Negativo') return 'impact-neg';
    return 'impact-neu';
}

function closeReport() {
    document.getElementById('report-overlay').style.display = 'none';
    document.body.style.overflow = 'auto';
}

init();
