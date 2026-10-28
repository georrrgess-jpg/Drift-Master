// Bundles src/ + vendor/three.min.js into one self-contained, offline-playable HTML file.
const fs = require('fs');
const path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
let html = read('src/index.html');
// use split/join so "$" sequences in the inlined code are left untouched
const inline = (marker, content) => { html = html.split(marker).join(content); };
inline('/*@@STYLE@@*/', read('src/style.css'));
inline('/*@@THREE@@*/', read('vendor/three.min.js').replace(/<\/script/gi, '<\\/script'));
inline('/*@@GAME@@*/', read('src/game.js').replace(/<\/script/gi, '<\\/script'));
fs.writeFileSync(path.join(__dirname, 'drift-master.html'), html);
console.log('Wrote drift-master.html (' + (html.length / 1024).toFixed(0) + ' KB)');
