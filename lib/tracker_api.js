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
  
  const launchOptions = {
    headless: true,
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu'
    ]
  };

  // Suporte a cache customizado (GitHub Actions)
  if (process.env.PUPPETEER_CACHE_DIR) {
    console.log(`🤖 [BROWSER] Usando Cache Dir: ${process.env.PUPPETEER_CACHE_DIR}`);
  }

  browserInstance = await puppeteer.launch(launchOptions);
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
    // Timeout de 15 segundos (Reduzido para evitar travamentos longos)
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    // Verifica se a resposta foi bem sucedida
    if (!response || !response.ok()) {
        const status = response ? response.status() : 'No Response';
        if (status === 403 || status === 429) {
          throw new Error(`Tracker-GG Bloqueou o Acesso (HTTP ${status}). Recomendado usar HenrikDev API ou Cache Local.`);
        }
        throw new Error(`Tracker-GG retornou erro HTTP ${status}.`);
    }

    // Extrai o conteúdo
    const content = await page.evaluate(() => document.body.innerText);
    
    // Detecção de Bloqueio (HTML em vez de JSON)
    if (content.includes('<!DOCTYPE html>') || content.includes('<html') || content.includes('Cloudflare') || content.includes('Access Denied')) {
      throw new Error('Bloqueio detectado (Cloudflare/Bot Protection). O Tracker-GG não retornou o JSON esperado.');
    }
    
    let jsonData;
    try {
      jsonData = JSON.parse(content);
    } catch (e) {
      throw new Error(`A resposta não é um JSON válido. Tracker-GG provavelmente bloqueou o Scraper.`);
    }
    
    await page.close();
    return jsonData;
  } catch (error) {
    if (page) await page.close().catch(() => {});
    throw error;
  }
}

/**
 * Fecha a instância do browser.
 */
export async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
    console.log(`🛑 [BROWSER] Instância encerrada.`);
  }
}
