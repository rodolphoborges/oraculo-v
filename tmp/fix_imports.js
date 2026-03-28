import fs from 'fs';
import path from 'path';

const scriptsDir = './scripts';
const files = fs.readdirSync(scriptsDir).filter(f => f.endsWith('.js'));

files.forEach(file => {
    const filePath = path.join(scriptsDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes("'./lib/supabase.js'") || content.includes('"./lib/supabase.js"')) {
        console.log(`Fixing ${file}...`);
        content = content.replace(/['"]\.\/lib\/supabase\.js['"]/g, "'../lib/supabase.js'");
        fs.writeFileSync(filePath, content, 'utf8');
    }
});
