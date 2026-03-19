import puppeteer from 'puppeteer';
import { supabase } from '../lib/supabase.js';

const ranks = ['iron', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'ascendant', 'immortal', 'radiant', 'ALL'];
const maps = ['ascent', 'bind', 'breeze', 'icebox', 'lotus', 'sunset', 'haven', 'abyss', 'Duality'];

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeTable(page) {
  return await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('div.v-table__wrapper table tbody tr'));
    return rows.map(row => {
      const cells = Array.from(row.querySelectorAll('td'));
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
    }).filter(row => row !== null);
  });
}

async function runExhaustiveScrape() {
  console.log('--- Iniciando Varredura Exaustiva ORÁCULO V ---');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Set viewport to ensure all data is rendered if needed
  await page.setViewport({ width: 1280, height: 800 });

  for (const rank of ranks) {
    for (const map of maps) {
      const url = `https://www.vstats.gg/agents?rank=${rank}&map=${map}&table=agents`;
      console.log(`Lendo Meta: Rank ${rank} no mapa ${map}...`);
      
      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        
        // Wait for the table to appear or a "no data" message
        try {
          await page.waitForSelector('div.v-table__wrapper table tbody tr', { timeout: 10000 });
        } catch (e) {
          console.log(`Dados no encontrados ou erro ao carregar para ${rank}/${map}. Pulando...`);
          continue;
        }

        const data = await scrapeTable(page);
        
        if (data && data.length > 0) {
          console.log(`Capturados ${data.length} agentes para ${rank}/${map}. Salvando no Supabase...`);
          
          const { error } = await supabase
            .from('raw_meta_snapshots')
            .insert({
              rank_tier: rank,
              map_name: map,
              data_payload: data
            });

          if (error) {
            console.error('Erro ao salvar no Supabase:', error.message);
          } else {
            console.log(`Dados de ${rank}/${map} salvos com sucesso.`);
          }
        } else {
          console.log(`Nenhum dado capturado para ${rank}/${map}.`);
        }

      } catch (error) {
        console.error(`Erro ao processar ${url}:`, error.message);
      }

      await delay(2000 + Math.random() * 2000); // Jitter ttico
    }
  }

  await browser.close();
  console.log('--- Varredura Concluda ---');
}

runExhaustiveScrape().catch(err => {
  console.error('Erro fatal no scraper:', err);
  process.exit(1);
});
