import dotenv from 'dotenv';
import fs from 'fs';

console.log("--- SYSTEM ENV VARS (SUPABASE_) ---");
Object.keys(process.env).filter(k => k.startsWith('SUPABASE_')).forEach(k => {
    console.log(`${k}=${process.env[k].replace(/(https?:\/\/).{4}/, "$1****")}`);
});

console.log("\n--- LOADING .env ---");
dotenv.config({ path: '.env', override: true });

console.log("\n--- AFTER .env LOAD ---");
Object.keys(process.env).filter(k => k.startsWith('SUPABASE_')).forEach(k => {
    console.log(`${k}=${process.env[k].replace(/(https?:\/\/).{4}/, "$1****")}`);
});

if (fs.existsSync('.env')) {
    console.log("\n--- .env RAW (Masked) ---");
    console.log(fs.readFileSync('.env', 'utf8').split('\n')
        .map(l => l.includes('SUPABASE_') ? l.replace(/(https?:\/\/).{4}/, "$1****") : l)
        .join('\n'));
}
