import { JSDOM } from 'jsdom';

// Função simulada de extração (cópia da lógica do main.js para teste isolado)
function scrapeTableInternal(document) {
  const rows = Array.from(document.querySelectorAll('div.v-table__wrapper table tbody tr'));
  return rows.map(row => {
    const cells = Array.from(row.querySelectorAll('td'));
    if (cells.length < 8) return null;
    return {
      rank: cells[0]?.textContent.trim(),
      role: cells[1]?.textContent.trim(),
      agent: cells[2]?.textContent.trim(),
      winRate: cells[3]?.textContent.trim(),
      nonMirrorWinRate: cells[4]?.textContent.trim(),
      pickRate: cells[5]?.textContent.trim(),
      kd: cells[6]?.textContent.trim(),
      matches: cells[7]?.textContent.trim(),
    };
  }).filter(row => row !== null);
}

// HTML Mock para simular a vstats.gg
const mockHTML = `
  <div class="v-table__wrapper">
    <table>
      <tbody>
        <tr>
          <td>Diamond</td>
          <td>Duelist</td>
          <td>Jett</td>
          <td>52%</td>
          <td>51%</td>
          <td>15%</td>
          <td>1.2</td>
          <td>1000</td>
        </tr>
        <tr>
          <td>Platinum</td>
          <td>Initiator</td>
          <td>Sova</td>
          <td>48%</td>
          <td>47%</td>
          <td>10%</td>
          <td>0.9</td>
          <td>800</td>
        </tr>
      </tbody>
    </table>
  </div>
`;

function test() {
  console.log('--- Iniciando Teste de Validação do Scraper ---');
  
  const dom = new JSDOM(mockHTML);
  const data = scrapeTableInternal(dom.window.document);
  
  if (data.length === 2) {
    console.log('✅ Sucesso: Capturou 2 registros.');
    console.log('Primeiro registro:', data[0]);
    
    if (data[0].agent === 'Jett' && data[0].rank === 'Diamond') {
      console.log('✅ Verificação de dados: OK');
    } else {
      console.error('❌ Erro: Dados incorretos no registro.');
      process.exit(1);
    }
  } else {
    console.error(`❌ Erro: Esperava 2 registros, mas obteve ${data.length}`);
    process.exit(1);
  }
  
  console.log('--- Teste Concluído com Sucesso ---');
}

test();
