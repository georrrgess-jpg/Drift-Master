// Prints the shortest safe segment length per speed for a target timing window.
// Usage: node tools/min-length-table.js 0.17
const { windows } = require('./feasibility.js');
const TARGET = +(process.argv[2] || 0.14), out = [];
for (let v = 6; v <= 13.01; v += 0.5) {
  const Ls = []; for (let L = 2.0; L <= 10.01; L += 0.5) Ls.push(L);
  const ok = Ls.map(L => { const w = windows(v, L, 7.0, 0.01); return Math.min(w.w1, w.w2) >= TARGET; });
  let min = null; for (let i = Ls.length - 1; i >= 0; i--) { if (ok[i]) min = Ls[i]; else break; }
  out.push([v, min]);
  console.log(v.toFixed(1), min, ok.map(o => o ? '+' : '.').join(''));
}
console.log(JSON.stringify(out));
