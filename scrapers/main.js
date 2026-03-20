import puppeteer from 'puppeteer';
import { supabase } from '../lib/supabase.js';

const ranks = ['iron', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'ascendant', 'immortal', 'radiant', 'ALL'];
const maps = ['bind', 'breeze', 'fracture', 'haven', 'lotus', 'pearl', 'split', 'ALL'];
const tables = ['agents', 'duos', 'comps'];

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeTable(page, tableType) {
  return await page.evaluate((type) => {
    const rows = Array.from(document.querySelectorAll('div.v-table__wrapper table tbody tr'));
    return rows.map(row => {
      const cells = Array.from(row.querySelectorAll('td'));
      
      if (type === 'agents') {
        if (cells.length < 8) return null;
        return {
          rank: cells[0]?.innerText.trim(),
          role: cells[1]?.innerText.trim(),
          agent: cells[2]?.innerText.trim(),
          winRate: cells[3]?.innerText.trim(),
          nonMirrorWinRate: cells[4]?.innerText.trim(),
          pickRate: cells[5]?.innerText.trim(),
          kd: cells[6]?.innerText.trim(),
          matches: cells[7]?.innerText.trim(),
        };
      } else {
        if (cells.length < 5) return null;
        const agents = Array.from(cells[1].querySelectorAll('img'))
          .map(img => img.alt || img.src.split('/').pop().split('.')[0])
          .join(', ');

        return {
          rank: cells[0]?.innerText.trim(),
          agents: agents,
          winRate: cells[2]?.innerText.trim(),
          roundWinRate: cells[3]?.innerText.trim(),
          matches: cells[4]?.innerText.trim(),
        };
      }
    }).filter(row => row !== null);
  }, tableType);
}

async function runExhaustiveScrape() {
  console.log('--- Iniciando Varredura EXAUSTIVA ORÁCULO V ---');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  for (const table of tables) {
    for (const rank of ranks) {
      for (const map of maps) {
        const url = `https://www.vstats.gg/agents?map=${map}&rank=${rank}&table=${table}${table === 'comps' ? '&min_matches=1' : ''}`;
        console.log(`Buscando: Tabela ${table} | Rank ${rank} | Mapa ${map}...`);
        
        try {
          await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
          
          try {
            await page.waitForSelector('div.v-table__wrapper table tbody tr', { timeout: 10000 });
          } catch (e) {
            console.log(`Sem dados disponíveis para esta combinação.`);
            continue;
          }

          const data = await scrapeTable(page, table);
          
          if (data && data.length > 0) {
            console.log(`Capturados ${data.length} registros. Salvando no Supabase...`);
            
            const { error } = await supabase
              .from('raw_meta_snapshots')
              .insert({
                rank_tier: rank,
                map_name: map,
                data_payload: {
                  table_type: table,
                  results: data,
                  captured_at: new Date().toISOString()
                }
              });

            if (error) {
              console.error('Erro ao salvar no Supabase:', error.message);
            } else {
              console.log(`Dados salvos com sucesso.`);
            }
          }
        } catch (error) {
          console.error(`Erro crítico no processo:`, error.message);
        }

        await delay(1500 + Math.random() * 1000); // Polidez e evitar detecção
      }
    }
  }

  await browser.close();
  console.log('--- VARREDURA EXAUSTIVA CONCLUÍDA COM SUCESSO ---');
}

runExhaustiveScrape().catch(err => {
  console.error('Erro fatal no scraper:', err);
  process.exit(1);
});
