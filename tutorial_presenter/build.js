// Builds tutorial-presenter.html (the install page with the bookmark) from src/.
// Usage: npm run build
const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

(async () => {
  const src = fs.readFileSync(path.join(__dirname, 'src/presenter.js'), 'utf8');
  const min = await minify(src, { compress: { passes: 2 }, mangle: true, format: { comments: false } });
  if (!min.code) throw new Error('minify failed');
  // void(...) so the browser never replaces the page with a return value
  const href = 'javascript:' + encodeURIComponent('void ' + min.code);
  const attr = href.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const tpl = fs.readFileSync(path.join(__dirname, 'src/install.template.html'), 'utf8');
  if (!tpl.includes('__HREF__')) throw new Error('template placeholder missing');
  fs.writeFileSync(path.join(__dirname, 'tutorial-presenter.html'), tpl.replace('__HREF__', () => attr));
  console.log('tutorial-presenter.html built: bookmark is ' + Math.round(href.length / 1024) + ' KB');
})().catch((e) => { console.error(e); process.exit(1); });
