/**
 * update-data.js
 * 
 * Compatibility wrapper for the legacy Protocolo-V data update script.
 * Redirects execution to the new exhaustive scraper in Oráculo-V.
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("🔄 [COMPAT] Redirecionando update-data.js -> scrapers/main.js...");

const scraperPath = path.join(__dirname, 'scrapers', 'main.js');

const child = spawn('node', [scraperPath], {
    stdio: 'inherit',
    env: process.env
});

child.on('close', (code) => {
    process.exit(code);
});
