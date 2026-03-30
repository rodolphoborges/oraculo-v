import fetch from 'node-fetch';

async function testAdminStats() {
    console.log('Testando /api/admin/stats...');
    try {
        const resp = await fetch('http://localhost:3000/api/admin/stats');
        const data = await resp.json();
        console.log('Status:', resp.status);
        console.log('Data:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Erro no teste:', e.message);
    }
}

testAdminStats();
