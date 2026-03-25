import { supabase } from '../lib/supabase.js';

async function checkQueue() {
  const { data, error } = await supabase
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

  const { data: latest, error: latestError } = await supabase
    .from('match_analysis_queue')
    .select('id, status, match_id, agente_tag, created_at, error_message')
    .order('created_at', { ascending: false })
    .limit(5);

  if (latestError) {
    console.error('Error fetching latest jobs:', latestError);
    return;
  }

  console.log('--- Últimos 5 Jobs ---');
  latest.forEach(job => {
    const time = new Date(job.created_at).toLocaleString();
    const error = job.error_message ? ` | Error: ${job.error_message.slice(0, 50)}...` : '';
    console.log(`[${job.status.toUpperCase()}] ${job.agente_tag} (${job.match_id}) em ${time}${error}`);
  });
}

checkQueue();
