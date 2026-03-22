import fs from 'fs';
import dotenv from 'dotenv';

console.log("--- DEBUG ENVIRONMENT ---");
if (fs.existsSync('.env')) {
    const content = fs.readFileSync('.env', 'utf8');
    console.log("File .env exists. CONTENT:");
    console.log(content.split('\n').map(line => line.startsWith('SUPABASE_URL') ? 
        line.replace(/(https?:\/\/).{4}/, "$1****") : line).join('\n'));
} else {
    console.log("File .env NOT FOUND in current directory.");
}

console.log("\nCurrent process.env.SUPABASE_URL (pre-dotenv):", 
    process.env.SUPABASE_URL ? process.env.SUPABASE_URL.replace(/(https?:\/\/).{4}/, "$1****") : 'undefined');

dotenv.config({ path: '.env', override: true });

console.log("Current process.env.SUPABASE_URL (post-dotenv):", 
    process.env.SUPABASE_URL ? process.env.SUPABASE_URL.replace(/(https?:\/\/).{4}/, "$1****") : 'undefined');

console.log("\nCWD:", process.cwd());
