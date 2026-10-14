// Inlines the stylesheet and script into one file: tutorial-builder.html
// Usage: npm run build
const fs = require('fs'), path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const html = read('builder.html').replace('/*CSS*/', () => read('builder.css')).replace('/*JS*/', () => read('builder.js'));
fs.writeFileSync(path.join(__dirname, 'tutorial-builder.html'), html);
console.log('tutorial-builder.html built: ' + Math.round(html.length / 1024) + ' KB');
