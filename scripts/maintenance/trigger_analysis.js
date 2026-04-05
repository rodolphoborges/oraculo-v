async function trigger() {
  const payload = {
    player_id: "ousadia#013",
    match_id: "74fc6ded-832d-461a-9359-aef174e420d3"
  };

  console.log('📡 Enviando Briefing para Oráculo-V...');
  try {
    const response = await fetch('http://localhost:3000/api/analyze', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    console.log('✅ Resposta do Servidor:', data);
  } catch (err) {
    console.error('❌ Falha no disparo:', err.message);
  }
}

trigger();
