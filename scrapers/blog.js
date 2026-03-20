import puppeteer from 'puppeteer';
import { supabase } from '../lib/supabase.js';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeBlogIndex(page) {
  return await page.evaluate(() => {
    // Busca todos os cards de blog (Vuetify a.v-card)
    const cards = Array.from(document.querySelectorAll('a.v-card[href^="/blog/"]'));
    return cards.map(card => ({
      title: card.querySelector('.v-list-item-title')?.innerText.trim(),
      url: card.href,
      description: card.querySelector('.v-card-subtitle')?.innerText.trim()
    }));
  });
}

async function scrapeArticleContent(page) {
  return await page.evaluate(() => {
    const title = document.querySelector('h1, .text-h4')?.innerText.trim();
    
    // Tenta encontrar a data de publicação
    const dateElement = Array.from(document.querySelectorAll('span, div')).find(el => 
      el.innerText.includes('Last Update:') || /\d{2}\/\d{2}\/\d{4}/.test(el.innerText)
    );
    let publishedAt = null;
    if (dateElement) {
      const match = dateElement.innerText.match(/\d{4}-\d{2}-\d{2}/) || dateElement.innerText.match(/\d{2}\/\d{2}\/\d{4}/);
      publishedAt = match ? match[0] : null;
    }

    // Pega o conteúdo principal (parágrafos e listas)
    const content = Array.from(document.querySelectorAll('p, h2, h3, h4, li'))
      .map(el => el.innerText.trim())
      .filter(text => text.length > 0)
      .join('\n\n');

    return { title, content, publishedAt };
  });
}

async function runBlogScrape() {
  console.log('--- Iniciando Captura do BLOG ORÁCULO V ---');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  try {
    console.log('Lendo índice do blog...');
    await page.goto('https://www.vstats.gg/blog', { waitUntil: 'networkidle2', timeout: 60000 });
    
    const articles = await scrapeBlogIndex(page);
    console.log(`Encontrados ${articles.length} artigos.`);

    for (const article of articles) {
      console.log(`\nProcessando: ${article.title}...`);
      
      try {
        await page.goto(article.url, { waitUntil: 'networkidle2', timeout: 60000 });
        const details = await scrapeArticleContent(page);

        const { error } = await supabase
          .from('blog_posts')
          .insert({
            title: details.title || article.title,
            url: article.url,
            description: article.description,
            content: details.content,
            published_at: details.publishedAt
          });

        if (error) {
          if (error.code === '23505') {
            console.log('Artigo já existe no banco. Pulando...');
          } else {
            console.error('Erro ao salvar no Supabase:', error.message);
          }
        } else {
          console.log(`Artigo salvo com sucesso!`);
        }
      } catch (err) {
        console.error(`Erro ao processar artigo ${article.url}:`, err.message);
      }

      await delay(2000);
    }

  } catch (error) {
    console.error('Erro crítico no scraper do blog:', error.message);
  }

  await browser.close();
  console.log('\n--- CAPTURA DO BLOG CONCLUÍDA ---');
}

runBlogScrape().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
