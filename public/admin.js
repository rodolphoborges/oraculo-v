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
            jobsList.innerHTML = '<tr><td colspan="5" style="text-align: center;">NENHUM_JOB_NA_FILA</td></tr>';
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

// Funções de Ação
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
