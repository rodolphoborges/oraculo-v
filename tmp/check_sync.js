import fetch from 'node-fetch';

async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/admin/queue/sync-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Text Start:', text.substring(0, 50));
  } catch (e) {
    console.error('Error:', e.message);
  }
}

test();
