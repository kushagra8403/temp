// Inlines src/ into one self-contained HTML file (and an artifact-ready variant without the document wrapper).
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'src');
const head = fs.readFileSync(path.join(dir, '00-head.html'), 'utf8');
const js = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort().map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
const html = head + js + '\n</script>\n</body>\n</html>\n';
fs.writeFileSync(path.join(__dirname, 'billion-dollar-company.html'), html);
if (process.argv[2]) {
  const frag = html
    .replace(/<!doctype html>\s*/i, '').replace(/<html[^>]*>\s*/i, '').replace(/<head>\s*/i, '')
    .replace(/<meta charset="utf-8">\s*/i, '').replace(/<meta name="viewport"[^>]*>\s*/i, '')
    .replace(/<\/head>\s*/i, '').replace(/<body>\s*/i, '').replace(/<\/body>\s*<\/html>\s*$/i, '\n');
  fs.writeFileSync(process.argv[2], frag);
}
console.log('built', (html.length / 1024).toFixed(1) + ' KB');
