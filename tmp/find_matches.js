import puppeteer from 'puppeteer';

async function searchMatch() {
    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    const url = 'https://tracker.gg/valorant/profile/riot/kugutsuhasu%232145/overview';
    
    console.log('Buscando partidas para kugutsuhasu#2145...');
    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        const matches = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a'))
                .map(a => a.href)
                .filter(href => href.includes('/match/'))
                .map(href => href.split('/').pop());
            return [...new Set(links)];
        });
        console.log('Match IDs encontrados:', matches.slice(0, 5));
    } catch (e) {
        console.error('Erro ao buscar matches:', e.message);
    } finally {
        await browser.close();
    }
}

searchMatch();
