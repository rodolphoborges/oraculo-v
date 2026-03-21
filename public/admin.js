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
                ? `<a href="index.html?player=${encodeURIComponent(job.player_tag)}&matchId=${job.match_id}" target="_blank" style="color:var(--green-ok);text-decoration:none;">[ ABRIR ]</a>`
                : '';

            row.innerHTML = `
                <td><code>${job.id.split('-')[0]}...</code></td>
                <td><b>${job.player_tag.toUpperCase()}</b></td>
                <td><small>${job.match_id}</small></td>
                <td><span class="status-pill ${statusClass}">${job.status}</span> ${openLink}</td>
                <td>${date}</td>
            `;
            jobsList.appendChild(row);
        });

    } catch (err) {
        console.error('Falha ao atualizar painel:', err);
    }
}

// Inicializa e agenda atualização a cada 10 segundos
updateStats();
setInterval(updateStats, 10000);
