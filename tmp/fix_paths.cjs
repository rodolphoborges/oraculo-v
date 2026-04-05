const fs = require('fs');
const path = require('path');

function fixDir(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (!file.endsWith('.js') && !file.endsWith('.mjs') && !file.endsWith('.py')) continue;
        const p = path.join(dir, file);
        let content = fs.readFileSync(p, 'utf8');
        
        let originalContent = content;
        
        // fix requires
        content = content.replace(/(require\(.*?)(['"])\.\//g, '$1$2../../');
        // fix imports/from
        content = content.replace(/(from\s+)(['"])\.\//g, '$1$2../../');
        content = content.replace(/(import\s+.*?)(['"])\.\//g, '$1$2../../');

        if (content !== originalContent) {
             fs.writeFileSync(p, content, 'utf8');
             console.log(`Fixed imports in ${p}`);
        }
    }
}

fixDir('c:/Users/rodol/OneDrive/Área de Trabalho/PROJETOS-V/oraculo-v/scripts/maintenance');
fixDir('c:/Users/rodol/OneDrive/Área de Trabalho/PROJETOS-V/oraculo-v/tests');
fixDir('c:/Users/rodol/OneDrive/Área de Trabalho/PROJETOS-V/protocolov/scripts/diagnostics');
console.log('Fixed relative imports');
