import puppeteer from 'puppeteer';

/**
 * Busca o JSON de uma partida diretamente da API do Tracker-GG.
 * @param {string} matchId UUID da partida
 * @returns {Promise<object>} Dados da partida
 */
let browserInstance = null;

/**
 * Retorna uma instância única do browser (Singleton) para economizar recursos.
 */
async function getBrowser() {
  if (browserInstance && browserInstance.connected) return browserInstance;
  
  browserInstance = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  return browserInstance;
}

/**
 * Busca o JSON de uma partida diretamente da API do Tracker-GG.
 * @param {string} matchId UUID da partida
 * @returns {Promise<object>} Dados da partida
 */
export async function fetchMatchJson(matchId) {
  const url = `https://api.tracker.gg/api/v2/valorant/standard/matches/${matchId}`;
  
  const browser = await getBrowser();
  const page = await browser.newPage();
  
  // User agent mais robusto
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
  
  try {
    console.error(`[SCRAPER] Acessando Tracker-GG: ${url}`);
    
    // Timeout de 60 segundos
    const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Verifica se a resposta foi bem sucedida
    if (!response || !response.ok()) {
        const status = response ? response.status() : 'No Response';
        throw new Error(`Tracker-GG retornou erro HTTP ${status}.`);
    }

    // Extrai o conteúdo
    const content = await page.evaluate(() => document.body.innerText);
    
    // Detecção de Bloqueio (HTML em vez de JSON)
    if (content.includes('<!DOCTYPE html>') || content.includes('<html') || content.includes('Cloudflare')) {
      throw new Error('Bloqueio detectado (Cloudflare/Bot Protection). O Tracker-GG não retornou o JSON esperado.');
    }
    
    let jsonData;
    try {
      jsonData = JSON.parse(content);
    } catch (e) {
      throw new Error(`A resposta não é um JSON válido. Conteúdo recebido: ${content.substring(0, 100)}...`);
    }
    
    await page.close();
    return jsonData;
  } catch (error) {
    if (page) await page.close().catch(() => {});
    throw error;
  }
}
