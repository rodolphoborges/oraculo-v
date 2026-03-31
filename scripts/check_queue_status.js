import { supabaseProtocol } from '../lib/supabase.js';

async function checkQueue() {
  if (!supabaseProtocol) {
    console.error('❌ Cliente Protocolo-V (supabaseProtocol) não está configurado.');
    return;
  }
  const { data, error } = await supabaseProtocol
    .from('match_analysis_queue')
    .select('status');

  if (error) {
    console.error('Error fetching queue stats:', error);
    return;
  }

  const summary = data.reduce((acc, curr) => {
    acc[curr.status] = (acc[curr.status] || 0) + 1;
    return acc;
  }, {});

  console.log('Queue Status Summary:');
  console.log(JSON.stringify(summary, null, 2));

  const { data: latest, error: latestError } = await supabaseProtocol
    .from('match_analysis_queue')
    .select('id, status, match_id, player_tag, created_at, error_msg')
    .order('created_at', { ascending: false })
    .limit(5);

  if (latestError) {
    console.error('Error fetching latest jobs:', latestError);
    return;
  }

  console.log('--- Últimos 5 Jobs ---');
  latest.forEach(job => {
    const time = new Date(job.created_at).toLocaleString();
    const error = job.error_msg ? ` | Error: ${job.error_msg.slice(0, 50)}...` : '';
    console.log(`[${job.status.toUpperCase()}] ${job.player_tag} (${job.match_id}) em ${time}${error}`);
  });
}

checkQueue();
