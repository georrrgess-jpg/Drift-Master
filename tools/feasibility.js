// Brute-force timing study for the road generator: simulates the game's exact car
// dynamics through an A -> B -> C zigzag and measures how wide the window is for
// timing each turn. Used to derive MIN_LEN_TABLE in src/game.js.
// Env: HW (half road width), TB/TK/GR (turn base, turn per speed, grip).
// Feasibility study: road A(+X... dir1) -> B (dir0, length L) -> C (dir1). Same dynamics as the game.
const HW = +(process.env.HW || 1.5), W = HW * 2, HALF = Math.PI / 2;
const PHYS = { turnBase: +(process.env.TB || 3.5), turnK: +(process.env.TK || 0.21), grip: +(process.env.GR || 7.0) };
// segments as in game: dir0 = -Z (ang pi/2), dir1 = +X (ang 0)
function seg(sx, sz, dir, len, s0) {
  const ux = dir ? 1 : 0, uz = dir ? 0 : -1;
  return { sx, sz, ux, uz, px: -uz, pz: ux, len, s0: s0 ?? HW, s1: len + HW, ex: sx + ux * len, ez: sz + uz * len };
}
function inside(s, x, z) { const dx = x - s.sx, dz = z - s.sz; const a = dx * s.ux + dz * s.uz, l = dx * s.px + dz * s.pz; return a >= s.s0 && a <= s.s1 && Math.abs(l) <= HW; }
function run(v, L, t1, t2, grip) {
  const A = seg(0, 0, 1, 12, -10), B = seg(A.ex, A.ez, 0, L), C = seg(B.ex, B.ez, 1, 30);
  const segs = [A, B, C];
  let x = 0, z = 0, psi = 0, phi = 0, t = 0; const dt = 1 / 240;
  const tr = PHYS.turnBase + v * PHYS.turnK;
  while (t < t2 + 2.5) {
    const target = t < t1 ? 0 : t < t2 ? HALF : 0;
    psi += Math.max(-tr * dt, Math.min(tr * dt, target - psi));
    phi += (psi - phi) * (1 - Math.exp(-grip * dt));
    x += Math.cos(phi) * v * dt; z -= Math.sin(phi) * v * dt; t += dt;
    if (!segs.some(s => inside(s, x, z))) return false;
  }
  return true;
}
// For given v, L: search feasible (t1, t2) grid; report max over t1 of the t2-window, and the t1 window.
function windows(v, L, grip = PHYS.grip, step = 0.005) { let best = { w2: 0, w1: 0 };
  const t1s = []; for (let t1 = 0.3; t1 < 10 / v + 0.5; t1 += step) t1s.push(t1);
  const feasT1 = [];
  for (const t1 of t1s) {
    let lo = null, hi = null;
    for (let t2 = t1; t2 < t1 + (L + 4) / v + 0.5; t2 += step) { if (run(v, L, t1, t2, grip)) { if (lo === null) lo = t2; hi = t2; } else if (lo !== null) break; }
    if (lo !== null) { feasT1.push(t1); best.w2 = Math.max(best.w2, hi - lo); }
  }
  best.w1 = feasT1.length ? feasT1[feasT1.length - 1] - feasT1[0] : 0;
  return best;
}
module.exports = { windows, run };
if (require.main === module) {
const target = +process.argv[2] || 0.12;
for (const v of [6.3, 7.5, 8.5, 9.5, 10.5, 11.5, 12.5, 12.9, 13.5]) {
  let found = null;
  for (let L = 1.5; L <= 8; L += 0.1) { const w = windows(v, L); if (w.w2 >= target && w.w1 >= target) { found = { L: +L.toFixed(1), ...w }; break; } }
  const cur = Math.max(3.1, 1.9 + v * 0.2);
  console.log(`v=${v}  minimal L for ${target}s windows: ${JSON.stringify(found)}  current minLen=${cur.toFixed(2)} -> ${JSON.stringify(windows(v, cur))}`);
}
}
