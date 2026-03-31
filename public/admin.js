let currentTab = 'queue';

function switchTab(tab) {
    currentTab = tab;
    document.getElementById('queueTab').style.display = tab === 'queue' ? 'block' : 'none';
    document.getElementById('pendingTab').style.display = tab === 'pending' ? 'block' : 'none';
    document.getElementById('historyTab').style.display = tab === 'history' ? 'block' : 'none';

    ['tabQueue', 'tabPending', 'tabHistory'].forEach(t => {
        const el = document.getElementById(t);
        const isActive = t.toLowerCase().includes(tab);
        el.style.borderBottom = isActive ? '2px solid var(--green-ok)' : 'none';
        el.style.color = isActive ? 'var(--green-ok)' : 'rgba(0,255,65,0.5)';
    });

    const selectAllCheckbox = document.getElementById('selectAll');
    const headerCol4 = document.getElementById('headerCol4');

    if (tab === 'queue') {
        headerCol4.textContent = 'STATUS';
        selectAllCheckbox.style.display = 'none';
        updateStats();
    } else if (tab === 'pending') {
        headerCol4.textContent = 'MAPA / AGENTE';
        selectAllCheckbox.style.display = 'inline-block';
        selectAllCheckbox.checked = false;
        loadPending();
    } else {
        headerCol4.textContent = 'PERFORMANCE';
        selectAllCheckbox.style.display = 'none';
        loadHistory();
    }
}

// Versão melhorada do Fetch para evitar erros de JSON quando o servidor retorna HTML (404/500)
async function safeFetch(url, options = {}) {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
        return data;
    } else {
        const text = await res.text();
        if (!res.ok) throw new Error(`Erro ${res.status}: Servidor retornou conteúdo não-JSON.`);
        return text;
    }
}

async function updateStats() {
    try {
        console.log('[DEBUG] Atualizando estatísticas globais...');
        const data = await safeFetch('/api/admin/stats');

        // Update Stats Cards (Sempre visíveis no topo)
        if (data.stats) {
            document.getElementById('statTotal').textContent = data.stats.total;
            document.getElementById('statPending').textContent = (data.stats.pending || 0) + (data.stats.processing || 0);
            document.getElementById('statFailed').textContent = data.stats.failed;
            
            // Se houver contador de pendentes na aba pendente (Squad Gaps)
            const pendLabel = document.getElementById('pendingCount');
            if (pendLabel && data.stats.pending_squads !== undefined) {
                pendLabel.textContent = data.stats.pending_squads;
            }
        }

        // Se estivermos na aba de Fila, renderizamos a tabela imediatamente com os 50 jobs do stats
        if (currentTab === 'queue') {
            console.log(`[DEBUG] Renderizando ${data.jobs?.length || 0} jobs na aba Fila.`);
            renderQueueTable(data.jobs);
        }

    } catch (err) {
        console.error('❌ Falha ao atualizar painel Admin:', err);
    }
}

function renderQueueTable(jobs) {
    const jobsList = document.getElementById('jobsList');
    
    if (!jobs || jobs.length === 0) {
        jobsList.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: rgba(0,255,65,0.5);">[ SILÊNCIO_OPERACIONAL ] // NENHUM_JOB_NA_FILA</td></tr>';
        return;
    }

    jobsList.innerHTML = '';

    jobs.forEach(job => {
        const row = document.createElement('tr');
        const date = new Date(job.created_at).toLocaleString('pt-BR');
        const statusClass = `status-${job.status}`;

        // Deep Link para o Protocolo-V
        const openLink = job.status === 'completed'
            ? `<a href="/protocol/analise.html?match=${job.match_id}&player=${encodeURIComponent(job.agente_tag)}" target="_blank" class="btn-view">[ VER ]</a>`
            : '';

        // Botões de ação
        const actionBtns = `
            <div class="action-cell">
                <button class="btn-action btn-reprocess" onclick="reprocessJob('${job.match_id}', '${job.agente_tag}')" title="Reprocessar">♻️ REPROCESSAR</button>
                <button class="btn-action btn-delete" onclick="deleteJob('${job.match_id}', '${job.agente_tag}')" title="Apagar">🗑️ APAGAR</button>
            </div>
        `;

        const matchIdShort = job.match_id ? `${job.match_id.substring(0, 8)}...` : '---';

        row.innerHTML = `
            <td></td>
            <td><code>${String(job.id).split('-')[0]}</code></td>
            <td><b>${job.agente_tag.toUpperCase()}</b></td>
            <td><span class="match-id-short" title="${job.match_id}">${matchIdShort}</span></td>
            <td><div class="score-box"><span class="status-pill status-${job.status}">${job.status}</span> ${openLink}</div></td>
            <td style="opacity: 0.7;">${date}</td>
            <td>${actionBtns}</td>
        `;
        jobsList.appendChild(row);
    });
}

let filterTimeout = null;

function onFilterChange() {
    if (filterTimeout) clearTimeout(filterTimeout);
    filterTimeout = setTimeout(() => {
        loadHistory();
    }, 500);
}

async function loadHistory() {
    try {
        const search = document.getElementById('histSearch')?.value || '';
        const date = document.getElementById('histDate')?.value || '';
        const sortMode = document.getElementById('histSort')?.value || 'recent';

        // Mapear opções do select para parâmetros da API
        let sortBy = 'date';
        let order = 'desc';

        if (sortMode === 'oldest') {
            sortBy = 'date';
            order = 'asc';
        } else if (sortMode === 'highScore') {
            sortBy = 'score';
            order = 'desc';
        } else if (sortMode === 'lowScore') {
            sortBy = 'score';
            order = 'asc';
        }

        const params = new URLSearchParams({
            search,
            date,
            sortBy,
            order
        });

        const data = await safeFetch(`/api/admin/history?${params.toString()}`);
        document.getElementById('historyCount').textContent = data.total;

        // ONLY update table if we are on the history tab
        if (currentTab === 'history') {
            renderHistoryTable(data.analyses);
        }

    } catch (err) {
        console.error('Falha ao carregar histórico:', err);
    }
}

function renderHistoryTable(analyses) {
    const jobsList = document.getElementById('jobsList');
    jobsList.innerHTML = '';

    if (!analyses || analyses.length === 0) {
        jobsList.innerHTML = '<tr><td colspan="6" style="text-align: center;">NENHUMA_ANÁLISE_NO_HISTÓRICO</td></tr>';
        return;
    }

    analyses.forEach(analysis => {
        const row = document.createElement('tr');
        const date = new Date(analysis.created_at).toLocaleString('pt-BR');

        // Botões de ação
        const actionBtns = `
            <div class="action-cell">
                <button class="btn-action btn-reprocess" onclick="reprocessJob('${analysis.match_id}', '${analysis.agente_tag}')" title="Reprocessar">♻️ REPROCESSAR</button>
                <button class="btn-action btn-delete" onclick="deleteJob('${analysis.match_id}', '${analysis.agente_tag}')" title="Apagar">🗑️ APAGAR</button>
            </div>
        `;

        // Link para análise direto no histórico
        const openLink = `<a href="/protocol/analise.html?match=${analysis.match_id}&player=${encodeURIComponent(analysis.agente_tag)}" target="_blank" class="btn-view">[ VER ]</a>`;
        
        const matchIdShort = analysis.match_id ? `${analysis.match_id.substring(0, 8)}...` : '---';
        const formattedScore = analysis.impact_score ? parseFloat(analysis.impact_score).toFixed(1) : '--';

        row.innerHTML = `
            <td></td>
            <td><code>${analysis.id ? String(analysis.id).split('-')[0] : '---'}</code></td>
            <td><b>${analysis.agente_tag.toUpperCase()}</b></td>
            <td><span class="match-id-short" title="${analysis.match_id}">${matchIdShort}</span></td>
            <td>
                <div class="score-box">
                    <span class="score-value">${formattedScore}</span>
                    ${openLink}
                </div>
            </td>
            <td style="opacity: 0.7;">${date}</td>
            <td>${actionBtns}</td>
        `;
        jobsList.appendChild(row);
    });
}

// Funções de Ação
async function deleteAllAnalyses() {
    if (!confirm(`⚠️ ATENÇÃO!\n\nIsso vai APAGAR TODO o histórico de forma permanente.\n\nDeseja continuar?`)) {
        return;
    }

    if (!confirm(`🗑️ Confirmação final: Apagar TODO o histórico?`)) {
        return;
    }

    try {
        const btn = document.getElementById('btnDeleteAllHistory');
        btn.disabled = true;
        btn.textContent = '⏳ APAGANDO...';

        const res = await fetch('/api/admin/analysis/all', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await res.json();
        if (res.ok) {
            alert(`✅ Histórico apagado!\n\nAnálises deletadas: ${data.deleted_count}\nArquivos locais deletados: ${data.local_files_deleted}`);
            loadHistory(); // Recarrega o histórico
        } else {
            alert('❌ Erro: ' + data.error);
        }

        btn.disabled = false;
        btn.textContent = '🗑️ APAGAR TODO HISTÓRICO';
    } catch (err) {
        alert('❌ Erro na requisição: ' + err.message);
        document.getElementById('btnDeleteAllHistory').disabled = false;
        document.getElementById('btnDeleteAllHistory').textContent = '🗑️ APAGAR TODO HISTÓRICO';
    }
}

async function deleteAllJobs() {
    if (!confirm(`⚠️ ATENÇÃO!\n\nIsso vai APAGAR TODAS as análises de forma permanente.\n\nDeseja continuar?`)) {
        return;
    }

    if (!confirm(`🗑️ Confirmação final: Apagar TODAS as análises?`)) {
        return;
    }

    try {
        const btn = document.getElementById('btnDeleteAll');
        btn.disabled = true;
        btn.textContent = '⏳ APAGANDO...';

        const res = await fetch('/api/admin/analysis/all', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await res.json();
        if (res.ok) {
            alert(`✅ Limpeza concluída!\n\nAnálises deletadas do banco: ${data.deleted_count}\nArquivos locais deletados: ${data.local_files_deleted}`);
            updateStats(); // Recarrega a tabela
        } else {
            alert('❌ Erro: ' + data.error);
        }

        btn.disabled = false;
        btn.textContent = '🗑️ APAGAR TODAS';
    } catch (err) {
        alert('❌ Erro na requisição: ' + err.message);
        document.getElementById('btnDeleteAll').disabled = false;
        document.getElementById('btnDeleteAll').textContent = '🗑️ APAGAR TODAS';
    }
}

async function deleteJob(matchId, playerId) {
    if (!confirm(`⚠️ Tem certeza que deseja APAGAR a análise?\n${playerId} | ${matchId}`)) {
        return;
    }

    try {
        const res = await fetch('/api/admin/analysis', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                match_id: matchId,
                player_id: playerId
            })
        });

        const data = await res.json();
        if (res.ok) {
            alert('✅ Análise apagada com sucesso!');
            if (currentTab === 'queue') updateStats();
            else loadHistory();
        } else {
            alert('❌ Erro: ' + data.error);
        }
    } catch (err) {
        alert('❌ Erro na requisição: ' + err.message);
    }
}

async function reprocessJob(matchId, playerId) {
    if (!confirm(`♻️ Reprocessar análise?\n${playerId} | ${matchId}`)) {
        return;
    }

    try {
        const btn = event.target;
        btn.disabled = true;
        btn.textContent = '⏳ PROCESSANDO...';

        const res = await fetch('/api/admin/reprocess', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                match_id: matchId,
                player_id: playerId
            })
        });

        const data = await res.json();
        if (res.ok) {
            alert(`✅ Reprocessado!\nRank: ${data.rank}\nScore: ${data.score}`);
            if (currentTab === 'queue') updateStats();
            else loadHistory();
        } else {
            alert('❌ Erro: ' + data.error);
        }
    } catch (err) {
        alert('❌ Erro na requisição: ' + err.message);
    } finally {
        // Garantir que os botões voltem ao normal após o reprocessamento ser enfileirado
        if (currentTab === 'queue') updateStats();
        else loadHistory();
    }
}

let currentPending = [];

// Gaps Táticos (Pendências)
async function loadPending() {
    try {
        const res = await fetch('/api/admin/pending-squads');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        currentPending = data.missing || [];
        document.getElementById('pendingCount').textContent = data.total;
        if (currentTab === 'pending') {
            renderPendingTable(currentPending);
        }
    } catch (err) {
        console.error('Falha ao carregar pendências:', err);
    }
}

function renderPendingTable(missing) {
    const jobsList = document.getElementById('jobsList');
    jobsList.innerHTML = '';
    
    // Atualizar visibilidade do botão de selecionados
    updatePendingControls();

    if (!missing || missing.length === 0) {
        jobsList.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 30px;">✅ TODAS AS OPERAÇÕES FORAM ANALISADAS!</td></tr>';
        return;
    }

    missing.forEach((item, index) => {
        const row = document.createElement('tr');
        const date = new Date(item.started_at).toLocaleString('pt-BR');
        const matchIdShort = item.match_id ? `${item.match_id.substring(0, 8)}...` : '---';

        row.innerHTML = `
            <td><input type="checkbox" class="pending-check" data-index="${index}" onclick="updatePendingControls()" style="cursor:pointer;"></td>
            <td><code>GAP_TACTIC</code></td>
            <td><b>${item.player_tag.toUpperCase()}</b></td>
            <td><span class="match-id-short" title="${item.match_id}">${matchIdShort}</span></td>
            <td style="font-size: 0.75rem;"><span style="color: var(--green-ok); opacity:0.8;">${item.map_name.toUpperCase()}</span> / <span style="opacity: 0.7;">${item.agent.toUpperCase()}</span></td>
            <td style="opacity: 0.7;">${date}</td>
            <td>
                <button class="btn-view" onclick="reprocessJob('${item.match_id}', '${item.player_tag}')" style="background:var(--green-ok); color:black; border:none; padding:4px 10px; cursor:pointer;">🚀 ANALISAR_AGORA</button>
            </td>
        `;
        jobsList.appendChild(row);
    });
}

function toggleSelectAll(checked) {
    const checks = document.querySelectorAll('.pending-check');
    checks.forEach(c => c.checked = checked);
    updatePendingControls();
}

function updatePendingControls() {
    const checks = document.querySelectorAll('.pending-check:checked');
    const btn = document.getElementById('btnAnalyzeSelected');
    if (btn) {
        btn.style.display = checks.length > 0 ? 'inline-block' : 'none';
        btn.textContent = `🚀 ANALISAR SELECIONADOS (${checks.length})`;
    }
}

async function analyzeSelected() {
    const checks = document.querySelectorAll('.pending-check:checked');
    const toAnalyze = Array.from(checks).map(c => currentPending[parseInt(c.dataset.index)]);
    
    if (!confirm(`🚀 Deseja ENFILEIRAR ${toAnalyze.length} análises para processamento?`)) return;

    await batchReprocess(toAnalyze);
}

async function analyzeAllPending() {
    if (!confirm(`🔥 ATENÇÃO: Deseja ENFILEIRAR TODAS as análises pendentes (Gap Tático)?`)) return;

    const btnAll = document.getElementById('btnAnalyzeAll');
    btnAll.disabled = true;
    btnAll.textContent = '⏳ SINCRONIZANDO COM SERVIDOR...';

    try {
        const data = await safeFetch('/api/admin/queue/sync-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        alert(`🚀 Missão Aceita!\n${data.total_in_queue || data.added} análises enfileiradas diretamente no servidor.`);
        updateStats();
    } catch (err) {
        alert(`❌ Erro de conexão: ${err.message}`);
    } finally {
        btnAll.disabled = false;
        btnAll.textContent = '🔥 ANALISAR TODOS (FILA)';
        loadPending();
    }
}

async function batchReprocess(items) {
    const btnAll = document.getElementById('btnAnalyzeAll');
    const btnSel = document.getElementById('btnAnalyzeSelected');
    
    btnAll.disabled = true;
    if (btnSel) btnSel.disabled = true;

    try {
        const data = await safeFetch('/api/admin/reprocess/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
        });
        
        alert(`🚀 Missão Aceita!\n${items.length} análises enviadas para o motor de processamento.`);
    } catch (err) {
        alert(`❌ Erro de conexão: ${err.message}`);
    } finally {
        btnAll.disabled = false;
        if (btnSel) btnSel.disabled = false;
        loadPending();
    }
}

// Inicializa e agenda atualização a cada 10 segundos
function autoRefresh() {
    updateStats(); // Sempre atualiza os cards de topo e a tabela se for queue
    
    // Atualiza dados secundários baseados na aba ativa
    if (currentTab === 'history') {
        loadHistory();
    } else if (currentTab === 'pending') {
        loadPending();
    }
}

autoRefresh();
setInterval(autoRefresh, 10000);

