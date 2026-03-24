// portal.js
let agents = {};
let operations = [];

function init() {
    agents = typeof ORACULO_DATABASE !== 'undefined' ? ORACULO_DATABASE : {};
    operations = typeof ORACULO_OPERATIONS !== 'undefined' ? ORACULO_OPERATIONS : [];
    
    renderDashboard();
    renderAgents();
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-view').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById(`view-${tabId}`).classList.add('active');
    
    // Find the button and activate it
    const btns = document.querySelectorAll('.nav-btn');
    btns.forEach(btn => {
        if (btn.textContent.toLowerCase().includes(tabId)) btn.classList.add('active');
    });

    document.getElementById('current-view').textContent = tabId.charAt(0).toUpperCase() + tabId.slice(1);
}

function renderDashboard() {
    const statsContainer = document.getElementById('dash-stats');
    const tableBody = document.getElementById('ops-table-body');
    
    // Calculate Stats
    const total = operations.length;
    const completed = operations.filter(o => o.status === 'completed').length;
    const failed = operations.filter(o => o.status === 'failed').length;
    const rate = total ? ((completed / total) * 100).toFixed(0) : 0;

    statsContainer.innerHTML = `
        <div class="stat-card">
            <div class="stat-label">Total de Jobs</div>
            <div class="stat-val">${total}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Taxa de Sucesso</div>
            <div class="stat-val" style="color: var(--success)">${rate}%</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Falhas</div>
            <div class="stat-val" style="color: var(--accent)">${failed}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Agentes Ativos</div>
            <div class="stat-val">${Object.keys(agents).length}</div>
        </div>
    `;

    // Render Table
    tableBody.innerHTML = operations.map(op => {
        const start = op.processed_at ? new Date(op.processed_at) : null;
        const end = op.metadata?.finished_at ? new Date(op.metadata.finished_at) : null;
        
        let duration = '---';
        if (start && end) {
            const diff = Math.round((end - start) / 1000);
            duration = diff > 60 ? `${Math.floor(diff/60)}m ${diff%60}s` : `${diff}s`;
        }

        const dateStr = op.created_at ? new Date(op.created_at).toLocaleString('pt-BR', { hour:'2-digit', minute:'2-digit', second:'2-digit' }) : '---';

        return `
            <tr>
                <td><code class="dim" style="font-size: 0.7rem;">${op.match_id.substring(0, 18)}...</code></td>
                <td><b>${op.agente_tag}</b></td>
                <td><span class="status-pill status-${op.status}">${op.status}</span></td>
                <td class="dim">${dateStr}</td>
                <td class="accent" style="font-weight: 600;">${duration}</td>
            </tr>
        `;
    }).join('');
}

function renderAgents() {
    const grid = document.getElementById('agent-grid');
    grid.innerHTML = Object.keys(agents).sort().map(tag => {
        const player = agents[tag];
        return `
            <div class="agent-card" onclick="viewAgentDetail('${tag}')">
                <div class="dim" style="font-size: 0.7rem; margin-bottom: 0.5rem;">REGISTRO ATIVO</div>
                <div style="font-size: 1.2rem; font-weight: 600; margin-bottom: 1rem;">${tag}</div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span class="dim">${player.matches.length} Partidas</span>
                    <span class="accent">Ver Histórico →</span>
                </div>
            </div>
        `;
    }).join('');
}

function viewAgentDetail(tag) {
    const player = agents[tag];
    document.getElementById('player-title').textContent = tag;
    const grid = document.getElementById('player-matches-grid');
    
    grid.innerHTML = player.matches.map(m => {
        const date = new Date(m.timestamp).toLocaleDateString('pt-BR');
        const data = m.analysis;
        return `
            <div class="agent-card" onclick="showReport('${tag}', '${m.id}')">
                <div class="dim" style="font-size: 0.7rem; margin-bottom: 0.5rem;">${date}</div>
                <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem;">${data.agent} @ ${data.map}</div>
                <div style="font-size: 1.5rem; font-weight: 800; color: var(--accent); margin-bottom: 1rem;">
                    IK ${data.performance_index}
                </div>
                <div class="status-pill status-completed" style="width: fit-content;">${data.performance_status || 'ANALISADO'}</div>
            </div>
        `;
    }).join('');

    switchTab('player-detail');
}

function showReport(playerTag, jobId) {
    const player = agents[playerTag];
    const match = player.matches.find(m => m.id === jobId);
    const data = match.analysis;
    
    const panel = document.getElementById('report-inner-content');
    
    panel.innerHTML = `
        <div style="text-align: center; margin-bottom: 3rem;">
            <div class="accent" style="font-weight: 800; letter-spacing: 2px; font-size: 0.7rem; margin-bottom: 1rem;">PROTOCOLO V // NÚCLEO TÁTICO</div>
            <h1 style="font-size: 2.5rem; margin-bottom: 0.5rem;">${data.performance_status || 'ANÁLISE DE CAMPO'}</h1>
            <div class="dim">Operação: ${match.matchId}</div>
        </div>

        <div class="stats-row">
            <div class="stat-card">
                <div class="stat-label">IK (Index)</div>
                <div class="stat-val" style="color: var(--accent)">${data.performance_index}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">ADR</div>
                <div class="stat-val">${data.adr}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">K/D</div>
                <div class="stat-val">${data.kd}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">ACS</div>
                <div class="stat-val">${data.acs || '---'}</div>
            </div>
        </div>

        <div style="background: rgba(255, 70, 85, 0.05); padding: 2rem; border-radius: 12px; border-left: 4px solid var(--accent); margin-bottom: 3rem;">
            <h3 style="margin-bottom: 1rem; color: var(--accent)">DIRETRIZ K.A.I.O.</h3>
            <p style="font-size: 1.1rem; line-height: 1.6; color: rgba(255,255,255,0.9)">${data.conselho_kaio}</p>
        </div>

        <h3>Eventos de Impacto</h3>
        <div style="margin-top: 1.5rem;">
            ${data.rounds.map(r => `
                <div style="display: flex; padding: 1rem 0; border-bottom: 1px solid var(--border); align-items: center;">
                    <div class="dim" style="width: 50px; font-weight: 800;">R${String(r.round).padStart(2, '0')}</div>
                    <div style="flex: 1; padding: 0 1rem;">${r.comment}</div>
                    <div style="width: 100px; text-align: right; font-weight: 700; font-size: 0.7rem;" class="${r.impacto === 'Positivo' ? 'status-completed' : (r.impacto === 'Negativo' ? 'accent' : 'dim')}">
                        ${r.impacto.toUpperCase()}
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    document.getElementById('report-overlay').style.display = 'block';
}

function closeReport() {
    document.getElementById('report-overlay').style.display = 'none';
}

// Global exposure for HTML onclicks
window.switchTab = switchTab;
window.viewAgentDetail = viewAgentDetail;
window.showReport = showReport;
window.closeReport = closeReport;

init();
