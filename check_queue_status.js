import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

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
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (latestError) {
    console.error('Error fetching latest jobs:', latestError);
    return;
  }

  console.log('Latest 5 jobs:');
  console.log(JSON.stringify(latest, null, 2));
}

checkQueue();
