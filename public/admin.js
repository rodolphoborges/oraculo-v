let currentTab = 'queue';

function switchTab(tab) {
    currentTab = tab;
    document.getElementById('queueTab').style.display = tab === 'queue' ? 'block' : 'none';
    document.getElementById('historyTab').style.display = tab === 'history' ? 'block' : 'none';

    document.getElementById('tabQueue').style.borderBottom = tab === 'queue' ? '2px solid var(--green-ok)' : 'none';
    document.getElementById('tabQueue').style.color = tab === 'queue' ? 'var(--green-ok)' : 'rgba(0,255,65,0.5)';

    document.getElementById('tabHistory').style.borderBottom = tab === 'history' ? '2px solid var(--green-ok)' : 'none';
    document.getElementById('tabHistory').style.color = tab === 'history' ? 'var(--green-ok)' : 'rgba(0,255,65,0.5)';

    // Atualizar header da tabela
    const headerCol4 = document.getElementById('headerCol4');
    if (tab === 'queue') {
        headerCol4.textContent = 'STATUS';
    } else {
        headerCol4.textContent = 'PERFORMANCE';
    }

    if (tab === 'history') {
        loadHistory();
    } else {
        updateStats();
    }
}

async function updateStats() {
    try {
        const res = await fetch('/api/admin/stats');
        const data = await res.json();

        if (!res.ok) throw new Error(data.error);

        // Update Stats Cards
        document.getElementById('statTotal').textContent = data.stats.total;
        document.getElementById('statPending').textContent = data.stats.pending + data.stats.processing;
        document.getElementById('statFailed').textContent = data.stats.failed;

        // Update Tables
        const jobsList = document.getElementById('jobsList');
        jobsList.innerHTML = '';

        if (data.jobs.length === 0) {
            jobsList.innerHTML = '<tr><td colspan="6" style="text-align: center;">NENHUM_JOB_NA_FILA</td></tr>';
            return;
        }

        data.jobs.forEach(job => {
            const row = document.createElement('tr');
            const date = new Date(job.created_at).toLocaleString('pt-BR');
            const statusClass = `status-${job.status}`;

            // Link para o relatório (Deep Link)
            const openLink = job.status === 'completed'
                ? `<a href="index.html?player=${encodeURIComponent(job.agente_tag)}&matchId=${job.match_id}" target="_blank" style="color:var(--green-ok);text-decoration:none;">[ ABRIR ]</a>`
                : '';

            // Botões de ação
            const actionBtns = `
                <button onclick="reprocessJob('${job.match_id}', '${job.agente_tag}')" style="background:none;border:none;color:#00ccff;cursor:pointer;font-size:0.8rem;margin-right:10px;" title="Reprocessar">♻️ REPROCESSAR</button>
                <button onclick="deleteJob('${job.match_id}', '${job.agente_tag}')" style="background:none;border:none;color:#ff4655;cursor:pointer;font-size:0.8rem;" title="Apagar">🗑️ APAGAR</button>
            `;

            row.innerHTML = `
                <td><code>${String(job.id).split('-')[0]}...</code></td>
                <td><b>${job.agente_tag.toUpperCase()}</b></td>
                <td><small>${job.match_id}</small></td>
                <td><span class="status-pill ${statusClass}">${job.status}</span> ${openLink}</td>
                <td>${date}</td>
                <td style="font-size:0.75rem;">${actionBtns}</td>
            `;
            jobsList.appendChild(row);
        });

    } catch (err) {
        console.error('Falha ao atualizar painel:', err);
    }
}

async function loadHistory() {
    try {
        const res = await fetch('/api/admin/history');
        const data = await res.json();

        if (!res.ok) throw new Error(data.error);

        document.getElementById('historyCount').textContent = data.total;

        // Reutiliza a tabela para histórico
        const jobsList = document.getElementById('jobsList');
        jobsList.innerHTML = '';

        if (data.analyses.length === 0) {
            jobsList.innerHTML = '<tr><td colspan="6" style="text-align: center;">NENHUMA_ANÁLISE_NO_HISTÓRICO</td></tr>';
            return;
        }

        data.analyses.forEach(analysis => {
            const row = document.createElement('tr');
            const date = new Date(analysis.created_at).toLocaleString('pt-BR');

            // Botões de ação
            const actionBtns = `
                <button onclick="reprocessJob('${analysis.match_id}', '${analysis.agente_tag}')" style="background:none;border:none;color:#00ccff;cursor:pointer;font-size:0.8rem;margin-right:10px;" title="Reprocessar">♻️ REPROCESSAR</button>
                <button onclick="deleteJob('${analysis.match_id}', '${analysis.agente_tag}')" style="background:none;border:none;color:#ff4655;cursor:pointer;font-size:0.8rem;" title="Apagar">🗑️ APAGAR</button>
            `;

            row.innerHTML = `
                <td><code>${String(analysis.id).split('-')[0]}...</code></td>
                <td><b>${analysis.agente_tag.toUpperCase()}</b></td>
                <td><small>${analysis.match_id}</small></td>
                <td style="color: var(--green-ok);">${analysis.impact_score}</td>
                <td>${date}</td>
                <td style="font-size:0.75rem;">${actionBtns}</td>
            `;
            jobsList.appendChild(row);
        });

    } catch (err) {
        console.error('Falha ao carregar histórico:', err);
    }
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
            updateStats(); // Recarrega a tabela
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
            updateStats(); // Recarrega a tabela
        } else {
            alert('❌ Erro: ' + data.error);
        }
    } catch (err) {
        alert('❌ Erro na requisição: ' + err.message);
    }
}

// Inicializa e agenda atualização a cada 10 segundos
updateStats();
setInterval(updateStats, 10000);
