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
  const url = `https://api.tracker.gg/api/v2/standard/matches/${matchId}`;
  
  const browser = await getBrowser();
  const page = await browser.newPage();
  
  // User agent para evitar bloqueios simples
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  try {
    // Timeout de 60 segundos para navegar e carregar
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Extrai o conteúdo da página (esperado que seja um JSON)
    const content = await page.evaluate(() => document.body.innerText);
    
    let jsonData;
    try {
      jsonData = JSON.parse(content);
    } catch (e) {
      throw new Error('A resposta recebida não é um JSON válido. O Tracker-GG pode estar bloqueando a requisição.');
    }
    
    await page.close(); // Fecha apenas a aba, não o browser
    return jsonData;
  } catch (error) {
    if (page) await page.close().catch(() => {});
    throw error;
  }
}
