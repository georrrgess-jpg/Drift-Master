/*
 * Drift Master — an original one-button endless drifting game.
 * Rendering by three.js (MIT). All models, music and art are generated in code.
 */
(function () {
'use strict';

const T = window.THREE;
const PI = Math.PI, HALF_PI = Math.PI / 2, TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const rand = (a, b) => a + Math.random() * (b - a);
const easeOutBounce = t => {
  const n = 7.5625, d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
};
const easeOutBack = t => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const fmt = n => Math.floor(n).toLocaleString('en-US');

/* =========================================================================
 * Save data
 * ========================================================================= */
const SAVE_KEY = 'drift-master-save-v1';
const DEFAULT_SAVE = {
  coins: 50, best: 0, runs: 0, totalCoins: 0, totalPerfects: 0,
  owned: ['rookie'], car: 'rookie',
  boosters: { double: 0, insurance: 0, coinrush: 0, headstart: 0 },
  active: { double: true, insurance: true, coinrush: true, headstart: true },
  upgrades: { traction: 0, magnet: 0 },
  settings: { sfx: true, music: true, quality: true, shake: true },
  lastSpin: 0, tutorial: false,
  level: 1, levelStars: {}, levelBest: {}
};
function loadSave() {
  const s = JSON.parse(JSON.stringify(DEFAULT_SAVE));
  let data = null;
  try { data = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { data = null; }
  if (data && typeof data === 'object') {
    for (const k in s) {
      if (data[k] === undefined) continue;
      if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k])) Object.assign(s[k], data[k]);
      else s[k] = data[k];
    }
  }
  return s;
}
let save = loadSave();
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* storage unavailable */ } }

/* =========================================================================
 * Audio — everything is synthesised with WebAudio
 * ========================================================================= */
const Sound = (() => {
  let ctx = null, master, sfx, music, noiseBuf;
  let eng1, eng2, engFilter, engGain, skidGain, skidFilter;
  let nextNote = 0, step = 0;
  const BPM = 118, S16 = 60 / BPM / 4;
  // Original loop: i - VI - III - VII in A minor
  const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
  const ARP = [0, 1, 2, 1, 2, 0, 2, 1, 0, 2, 1, 2, 0, 1, 2, 1];
  const LEAD = [ // sparse melody, per bar, 16 steps (-1 = rest), semitone offsets from chord root + 24
    [7, -1, -1, 5, -1, -1, 3, -1, 2, -1, 3, -1, -1, -1, -1, -1],
    [7, -1, -1, 8, -1, -1, 7, -1, 3, -1, -1, -1, 0, -1, -1, -1],
    [7, -1, -1, 4, -1, -1, 7, -1, 12, -1, 11, -1, 7, -1, -1, -1],
    [5, -1, -1, 7, -1, -1, 9, -1, 7, -1, 5, -1, 2, -1, -1, -1]
  ];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.85;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.connect(master);
    music = ctx.createGain(); music.gain.value = 0; music.connect(master);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    eng1 = ctx.createOscillator(); eng1.type = 'sawtooth'; eng1.frequency.value = 55;
    eng2 = ctx.createOscillator(); eng2.type = 'square'; eng2.frequency.value = 27;
    engFilter = ctx.createBiquadFilter(); engFilter.type = 'lowpass'; engFilter.frequency.value = 380; engFilter.Q.value = 3;
    engGain = ctx.createGain(); engGain.gain.value = 0;
    const sub = ctx.createGain(); sub.gain.value = 0.4;
    eng1.connect(engFilter); eng2.connect(sub); sub.connect(engFilter);
    engFilter.connect(engGain); engGain.connect(sfx);
    eng1.start(); eng2.start();

    const skid = ctx.createBufferSource(); skid.buffer = noiseBuf; skid.loop = true;
    skidFilter = ctx.createBiquadFilter(); skidFilter.type = 'bandpass'; skidFilter.frequency.value = 1700; skidFilter.Q.value = 1.4;
    skidGain = ctx.createGain(); skidGain.gain.value = 0;
    skid.connect(skidFilter); skidFilter.connect(skidGain); skidGain.connect(sfx); skid.start();

    apply();
    nextNote = ctx.currentTime + 0.15;
    setInterval(schedule, 25);
  }
  function apply() {
    if (!ctx) return;
    const t = ctx.currentTime;
    sfx.gain.setTargetAtTime(save.settings.sfx ? 1 : 0, t, 0.02);
    music.gain.setTargetAtTime(save.settings.music ? 0.17 : 0, t, 0.3);
  }
  function engine(on, speed, slip) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const f = 42 + speed * 6.5 + slip * 25;
    eng1.frequency.setTargetAtTime(f, t, 0.06);
    eng2.frequency.setTargetAtTime(f * 0.5, t, 0.06);
    engFilter.frequency.setTargetAtTime(300 + speed * 30, t, 0.1);
    engGain.gain.setTargetAtTime(on ? 0.06 : 0, t, 0.12);
    skidGain.gain.setTargetAtTime(on ? clamp(slip, 0, 1) * 0.16 : 0, t, 0.05);
    skidFilter.frequency.setTargetAtTime(1300 + speed * 50, t, 0.1);
  }
  function tone(freq, dur, type, vol, to, delay, dest) {
    if (!ctx) return;
    const t = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator(); o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || sfx);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, freq, type, delay, dest, at) {
    if (!ctx) return;
    const t = at !== undefined ? at : ctx.currentTime + (delay || 0);
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq || 1000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || sfx);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  function note(freq, t, dur, type, vol) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(music); o.start(t); o.stop(t + dur + 0.05);
  }
  function kick(t) {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(music); o.start(t); o.stop(t + 0.25);
  }
  function schedule() {
    if (!ctx) return;
    if (!save.settings.music || ctx.state !== 'running') { nextNote = ctx.currentTime + 0.1; return; }
    while (nextNote < ctx.currentTime + 0.12) { playStep(step, nextNote); nextNote += S16; step = (step + 1) % 128; }
  }
  function playStep(st, t) {
    const bar = (st >> 4) & 3, i = st & 15, ch = CHORDS[bar], section = st >> 6;
    if (i % 4 === 0) kick(t);
    if (i % 4 === 2) noise(0.05, 0.12, 8000, 'highpass', 0, music, t);
    if (i === 4 || i === 12) noise(0.14, 0.25, 1800, 'bandpass', 0, music, t);
    if (i % 2 === 0) note(mtof(ch[0] - 24 + (i % 8 === 6 ? 12 : 0)), t, S16 * 1.8, 'triangle', 0.32);
    note(mtof(ch[ARP[i]] + 12), t, S16 * 0.9, 'square', 0.035);
    if (section === 1) {
      const l = LEAD[bar][i];
      if (l >= 0) note(mtof(ch[0] + 12 + l), t, S16 * 2.6, 'triangle', 0.12);
    }
  }
  return {
    ensure, apply, engine,
    coin() { tone(1318.5, 0.08, 'square', 0.07); tone(1975.5, 0.18, 'square', 0.07, null, 0.06); },
    click() { tone(520, 0.06, 'triangle', 0.12, 760); },
    tick() { tone(1400, 0.03, 'square', 0.05); },
    perfect(n) { const b = 660 * Math.pow(1.06, Math.min(n, 10)); tone(b, 0.1, 'triangle', 0.12); tone(b * 1.5, 0.16, 'triangle', 0.1, null, 0.07); },
    fall() { tone(520, 1.0, 'sawtooth', 0.09, 70); noise(0.6, 0.18, 600, 'lowpass', 0.05); },
    buy() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'triangle', 0.12, null, i * 0.06)); },
    best() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.22, 'square', 0.06, null, i * 0.09)); },
    revive() { tone(300, 0.5, 'triangle', 0.14, 900); },
    deny() { tone(220, 0.12, 'square', 0.08); tone(180, 0.16, 'square', 0.08, null, 0.1); },
    whoosh() { noise(0.35, 0.16, 900, 'bandpass'); },
    go() { tone(880, 0.12, 'triangle', 0.12); tone(1320, 0.25, 'triangle', 0.12, null, 0.1); }
  };
})();

/* =========================================================================
 * Renderer, scene, sky, lights
 * ========================================================================= */
const canvas = $('#scene');
const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.type = T.PCFSoftShadowMap;
const maxAniso = renderer.capabilities.getMaxAnisotropy();

const scene = new T.Scene();
const camera = new T.PerspectiveCamera(40, 1, 0.1, 700);
scene.fog = new T.Fog(0xf08a3c, 30, 78);

const SKIES = [
  { name: 'Sunset', top: '#ffc46b', mid: '#f99a45', bot: '#ee7f38', cloud: '#ffe2c2' },
  { name: 'Rose Dusk', top: '#ffb3a7', mid: '#ff8aa6', bot: '#ef6f99', cloud: '#ffe0ea' },
  { name: 'Twilight', top: '#8f7cff', mid: '#b08af5', bot: '#d48ad8', cloud: '#f0e2ff' },
  { name: 'Midnight', top: '#1b2463', mid: '#33449a', bot: '#4b5fc0', cloud: '#a9b6ff' },
  { name: 'Daybreak', top: '#7fd3ff', mid: '#a9e3fb', bot: '#c9eefa', cloud: '#ffffff' },
  { name: 'Aurora', top: '#2fb9a6', mid: '#56d6b5', bot: '#8fe6c4', cloud: '#e5fff6' }
];
const skyUniforms = { top: { value: new T.Color(SKIES[0].top) }, mid: { value: new T.Color(SKIES[0].mid) }, bot: { value: new T.Color(SKIES[0].bot) }, time: { value: 0 } };
const sky = new T.Mesh(new T.SphereGeometry(320, 32, 20), new T.ShaderMaterial({
  uniforms: skyUniforms, side: T.BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: [
    'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform float time; varying vec3 vP;',
    'void main(){',
    '  float h = vP.y;',
    '  vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.55, h)) : mix(mid, bot, smoothstep(0.0, 0.35, -h));',
    '  float band = sin(h * 140.0 + time * 0.4) * 0.5 + 0.5;',
    '  c += (band - 0.5) * 0.018 * (1.0 - smoothstep(0.0, 0.5, abs(h + 0.08)));',
    '  gl_FragColor = vec4(c, 1.0);',
    '}'
  ].join('\n')
}));
sky.renderOrder = -10;
scene.add(sky);
const skyState = { idx: 0, target: 0, cur: { top: new T.Color(SKIES[0].top), mid: new T.Color(SKIES[0].mid), bot: new T.Color(SKIES[0].bot), cloud: new T.Color(SKIES[0].cloud) } };

const hemi = new T.HemisphereLight(0xffffff, 0xc98a6a, 0.58);
scene.add(hemi);
const sun = new T.DirectionalLight(0xfff4e6, 0.58);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera; sc.left = -14; sc.right = 14; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 60;
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

function applyQuality() {
  const hq = !!save.settings.quality;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, hq ? 2 : 1.25));
  renderer.shadowMap.enabled = hq;
  sun.castShadow = hq;
  blobShadow.visible = !hq;
  scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); });
  resize();
}

/* Floating low-poly clouds below the road */
const cloudMat = new T.MeshLambertMaterial({ color: 0xffe2c2, flatShading: true, transparent: true, opacity: 0.55, emissive: 0x553322, emissiveIntensity: 0.3, depthWrite: false });
const cloudGeo = new T.IcosahedronGeometry(1, 0);
const clouds = [];
function makeCloud() {
  const g = new T.Group();
  const n = 3 + ((Math.random() * 3) | 0);
  for (let i = 0; i < n; i++) {
    const m = new T.Mesh(cloudGeo, cloudMat);
    const s = rand(1.8, 3.4);
    m.scale.set(s * rand(1, 1.4), s * 0.75, s);
    m.position.set((i - n / 2) * 2.3 + rand(-0.5, 0.5), rand(-0.4, 0.8), rand(-1, 1));
    m.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
    g.add(m);
  }
  g.userData.vx = rand(0.3, 0.9);
  scene.add(g);
  return g;
}
for (let i = 0; i < 14; i++) clouds.push(makeCloud());
function placeCloud(c, around, ahead) {
  const fwd = ahead ? rand(28, 55) : rand(-25, 55);
  const side = rand(-38, 38);
  c.position.set(around.x + fwd * 0.707 + side * 0.707, rand(-38, -22), around.z - fwd * 0.707 + side * 0.707);
}

/* =========================================================================
 * Road themes & textures
 * ========================================================================= */
const THEMES = [
  { name: 'Meadow', pattern: 'stripes', a: '#a6ea6e', b: '#cdf7a0', side: '#4e9d38', edge: '#7fcf55' },
  { name: 'Glacier', pattern: 'checker', a: '#8bbff0', b: '#d9eafc', side: '#2b4f8c', edge: '#5b86c9' },
  { name: 'Bubblegum', pattern: 'checker', a: '#f59cad', b: '#fde4e9', side: '#b64c68', edge: '#e07890' },
  { name: 'Lemonade', pattern: 'stripes', a: '#ffd862', b: '#fff1b5', side: '#c3911a', edge: '#ebbd3c' },
  { name: 'Lavender', pattern: 'checker', a: '#bba0f4', b: '#eee5ff', side: '#6848a8', edge: '#9878d8' },
  { name: 'Lagoon', pattern: 'stripes', a: '#68ddc6', b: '#c9fbf0', side: '#1f8e78', edge: '#47bfa5' },
  { name: 'Ember', pattern: 'checker', a: '#ffa167', b: '#ffe4cf', side: '#b3552c', edge: '#e07c4a' },
  { name: 'Slate', pattern: 'stripes', a: '#9aa6c4', b: '#d7deee', side: '#3d4766', edge: '#6b7699' }
];
function makePatternTexture(th) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = th.a; g.fillRect(0, 0, 128, 128);
  g.fillStyle = th.b;
  if (th.pattern === 'stripes') {
    for (let k = -128; k < 256; k += 32) {
      g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 15, 0); g.lineTo(k + 15 - 128, 128); g.lineTo(k - 128, 128); g.closePath(); g.fill();
    }
  } else {
    g.fillRect(0, 0, 64, 64); g.fillRect(64, 64, 64, 64);
    g.globalAlpha = 0.07; g.fillStyle = '#000';
    g.fillRect(0, 63, 128, 2); g.fillRect(63, 0, 2, 128); g.fillRect(0, 127, 128, 1); g.fillRect(127, 0, 1, 128);
  }
  const tex = new T.CanvasTexture(c);
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.anisotropy = maxAniso;
  return tex;
}
THEMES.forEach(th => {
  th.top = new T.MeshLambertMaterial({ map: makePatternTexture(th), side: T.DoubleSide });
  th.sideMat = new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide });
  th.sideC = new T.Color(th.side); th.edgeC = new T.Color(th.edge); th.darkC = new T.Color(th.side).multiplyScalar(0.55);
});

/* =========================================================================
 * Track
 * ========================================================================= */
const ROAD_W = 3.0, ROAD_T = 0.85, UV_SCALE = 1 / 1.6;
const DIRS = [{ x: 0, z: -1, ang: HALF_PI }, { x: 1, z: 0, ang: 0 }]; // 0 = release (up-left), 1 = hold (up-right)

class Segment {
  constructor(index, sx, sz, dir, len, theme, opts) {
    this.index = index; this.sx = sx; this.sz = sz; this.dir = dir;
    const d = DIRS[dir];
    this.ux = d.x; this.uz = d.z; this.ang = d.ang;
    this.px = -this.uz; this.pz = this.ux;
    this.len = len;
    this.s0 = opts.s0 !== undefined ? opts.s0 : ROAD_W / 2;
    this.s1 = len + ROAD_W / 2;
    this.ex = sx + this.ux * len; this.ez = sz + this.uz * len;
    this.theme = theme;
    this.wave = null;
    if (opts.wave) {
      const a = ROAD_W / 2 + 0.2, b = len - ROAD_W / 2 - 0.2;
      if (b - a > 3) this.wave = { a, b, n: opts.wave.n, A: opts.wave.A };
    }
    this.coins = [];
    this.state = 'hidden'; this.anim = 0; this.vy = 0; this.delay = 0;
    this.checked = false;
  }
  local(x, z) { const dx = x - this.sx, dz = z - this.sz; return [dx * this.ux + dz * this.uz, dx * this.px + dz * this.pz]; }
  contains(x, z) { const l = this.local(x, z); return l[0] >= this.s0 && l[0] <= this.s1 && Math.abs(l[1]) <= ROAD_W / 2; }
  height(s) {
    const w = this.wave;
    if (!w || s <= w.a || s >= w.b) return 0;
    const t = (s - w.a) / (w.b - w.a);
    return w.A * (1 - Math.cos(TAU * w.n * t)) * 0.5;
  }
  wx(s, l) { return this.sx + this.ux * s + this.px * l; }
  wz(s, l) { return this.sz + this.uz * s + this.pz * l; }
}

function buildSegmentMesh(seg) {
  const th = THEMES[seg.theme];
  const pos = [], uv = [], col = [];
  const ss = [];
  if (seg.wave) {
    const n = Math.max(2, Math.ceil((seg.s1 - seg.s0) / 0.2));
    for (let i = 0; i <= n; i++) ss.push(seg.s0 + (seg.s1 - seg.s0) * i / n);
  } else { ss.push(seg.s0, seg.s1); }
  const hw = ROAD_W / 2;
  const white = { r: 1, g: 1, b: 1 };
  const V = (x, y, z, c) => { pos.push(x, y, z); uv.push(x * UV_SCALE, z * UV_SCALE); col.push(c.r, c.g, c.b); };
  const quad = (a, b, c, d, ca, cb, cc, cd) => { V(...a, ca); V(...b, cb); V(...c, cc); V(...a, ca); V(...c, cc); V(...d, cd); };
  // top
  for (let k = 0; k < ss.length - 1; k++) {
    const sa = ss[k], sb = ss[k + 1], ha = seg.height(sa), hb = seg.height(sb);
    quad([seg.wx(sa, -hw), ha, seg.wz(sa, -hw)], [seg.wx(sb, -hw), hb, seg.wz(sb, -hw)], [seg.wx(sb, hw), hb, seg.wz(sb, hw)], [seg.wx(sa, hw), ha, seg.wz(sa, hw)], white, white, white, white);
  }
  const topCount = pos.length / 3;
  // sides
  const E = th.edgeC, S = th.sideC, D = th.darkC;
  for (const l of [-hw, hw]) {
    for (let k = 0; k < ss.length - 1; k++) {
      const sa = ss[k], sb = ss[k + 1], ha = seg.height(sa), hb = seg.height(sb);
      const xa = seg.wx(sa, l), za = seg.wz(sa, l), xb = seg.wx(sb, l), zb = seg.wz(sb, l);
      // thin bright lip, then the main wall
      quad([xa, ha, za], [xb, hb, zb], [xb, hb - 0.08, zb], [xa, ha - 0.08, za], E, E, E, E);
      quad([xa, ha - 0.08, za], [xb, hb - 0.08, zb], [xb, hb - ROAD_T, zb], [xa, ha - ROAD_T, za], S, S, D, D);
    }
  }
  for (const s of [seg.s0, seg.s1]) {
    const h = seg.height(s);
    const xa = seg.wx(s, -hw), za = seg.wz(s, -hw), xb = seg.wx(s, hw), zb = seg.wz(s, hw);
    quad([xa, h, za], [xb, h, zb], [xb, h - 0.08, zb], [xa, h - 0.08, za], E, E, E, E);
    quad([xa, h - 0.08, za], [xb, h - 0.08, zb], [xb, h - ROAD_T, zb], [xa, h - ROAD_T, za], S, S, D, D);
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  geo.addGroup(0, topCount, 0);
  geo.addGroup(topCount, pos.length / 3 - topCount, 1);
  geo.computeVertexNormals();
  const mesh = new T.Mesh(geo, [th.top, th.sideMat]);
  mesh.receiveShadow = true;
  return mesh;
}

const unitBoxR = new T.BoxGeometry(1, 1, 1);

/* coins */
const coinGeo = new T.CylinderGeometry(0.24, 0.24, 0.07, 18);
coinGeo.rotateX(HALF_PI);
const coinInnerGeo = new T.CylinderGeometry(0.15, 0.15, 0.085, 4);
coinInnerGeo.rotateX(HALF_PI);
const coinMat = new T.MeshLambertMaterial({ color: 0xffc928, emissive: 0xb86a00, emissiveIntensity: 0.45 });
const coinInnerMat = new T.MeshLambertMaterial({ color: 0xffe377, emissive: 0xd08000, emissiveIntensity: 0.4 });
function makeCoin() {
  const g = new T.Group();
  const a = new T.Mesh(coinGeo, coinMat); a.castShadow = true;
  const b = new T.Mesh(coinInnerGeo, coinInnerMat);
  g.add(a, b);
  return g;
}

function mulberry32(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const track = { segs: [], group: new T.Group(), base: 0, themeIdx: 0, themeLeft: 12, rng: Math.random, mode: 'endless', level: null, finishSeg: null, coinTotal: 0 };
scene.add(track.group);

/* Level n: a fixed (seeded) layout that ends at a finish line. Speed and
 * length grow with n, so the level list never ends. */
function levelParams(n) {
  return {
    n, seed: n * 7919 + 101,
    len: Math.min(120 + n * 22, 1000),
    speed: Math.min(12.0, 6.4 + (n - 1) * 0.19),
    diff: clamp(n / 30, 0, 1),
    waveP: clamp((n - 2) * 0.045, 0, 0.5),
    shortP: clamp(0.15 + n * 0.012, 0.15, 0.45),
    theme: (n - 1) % THEMES.length,
    sky: (n - 1) % SKIES.length
  };
}

// Speed the car aims for after travelling `dist`.
function speedAt(dist) {
  if (track.mode === 'level' && track.level) return track.level.speed * (0.8 + 0.2 * Math.min(1, dist / 40));
  return PHYS.base + PHYS.add * (1 - Math.exp(-dist / PHYS.k));
}

/* Shortest segment that still leaves a human at least a 0.17 s window to time
 * each turn at speed v. The table comes from brute-force simulation of these
 * exact car dynamics over every pair of switch times: up to speed 9 any length
 * works, above that a band of short lengths gets too tight. Above 12 even long
 * segments drop below 0.17 s, so both modes cap their speed at 12. Each speed
 * is rounded up to the next bracket and a margin added, so a generated corner
 * can never become physically impossible. */
const MIN_LEN_TABLE = [[9.0, 2.0], [9.5, 3.5], [10, 3.5], [10.5, 4.0], [11, 4.5], [11.5, 5.0], [12, 5.0]];
function minLenFor(v) {
  let L = 3.0; // visual minimum
  for (const [sp, len] of MIN_LEN_TABLE) if (v > sp - 0.5) L = Math.max(L, len);
  return L + 0.25;
}

const finishTex = (() => {
  const c = document.createElement('canvas'); c.width = 128; c.height = 32;
  const g = c.getContext('2d');
  for (let x = 0; x < 8; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? '#1d1d24' : '#ffffff'; g.fillRect(x * 16, y * 16, 16, 16); }
  const t = new T.CanvasTexture(c); t.anisotropy = maxAniso; return t;
})();

function disposeSeg(seg) {
  track.group.remove(seg.group);
  seg.mesh.geometry.dispose();
}
function resetTrack(intro, cfg) {
  cfg = cfg || { mode: 'endless' };
  track.segs.forEach(disposeSeg);
  track.segs = []; track.base = 0;
  track.mode = cfg.mode; track.level = cfg.level || null; track.finishSeg = null; track.coinTotal = 0;
  track.rng = track.level ? mulberry32(track.level.seed) : Math.random;
  track.themeIdx = track.level ? track.level.theme : 0;
  track.themeLeft = 10 + ((track.rng() * 5) | 0);
  const first = addSegment(new Segment(0, 0, 0, 0, 11, track.themeIdx, { s0: -4.5 }));
  first.pathStart = 0;
  for (let i = 0; i < 14; i++) if (!genNext(0)) break;
  track.segs.forEach((s, i) => {
    if (intro) { s.state = 'rising'; s.anim = 0; s.delay = 0.08 + i * 0.07; s.group.visible = true; s.group.position.y = -9; }
    else { s.state = 'idle'; s.group.visible = true; s.group.position.y = 0; }
  });
}
function addSegment(seg) {
  seg.group = new T.Group();
  seg.mesh = buildSegmentMesh(seg);
  seg.group.add(seg.mesh);
  seg.group.visible = false;
  seg.group.position.y = -9;
  track.group.add(seg.group);
  track.segs.push(seg);
  return seg;
}
function segAt(index) { return track.segs[index - track.base]; }
function lastSeg() { return track.segs[track.segs.length - 1]; }
function pathPos() {
  const seg = segAt(car.segIdx);
  return seg ? seg.pathStart + clamp(seg.local(car.x, car.z)[0], 0, seg.len) : 0;
}

function genNext(dist) {
  if (track.finishSeg) return null;
  const prev = lastSeg();
  const R = track.rng;
  const lvl = track.mode === 'level' ? track.level : null;
  const pathStart = prev.pathStart + prev.len;
  if (lvl && pathStart >= lvl.len) return makeFinish(prev, pathStart);
  const d = lvl ? lvl.diff : clamp(dist / 3000, 0, 1);
  // size corners for the fastest the car can be going when it reaches them
  const v = lvl ? lvl.speed : speedAt(dist + 120);
  const minLen = minLenFor(v);
  const maxLen = Math.max(minLen + 2.5, lerp(11, 8.5, d) + 1);
  let len;
  const r = R();
  if (r < 0.1) len = 11 + R() * 4;
  else if (r < (lvl ? lvl.shortP : 0.3 + d * 0.2)) len = minLen + R() * 1.6;
  else len = minLen + 1.2 + R() * (maxLen - minLen - 1.2);
  // never chain two short segments: the timing study assumes the car has settled
  // onto a segment before its next corner, which needs one comfortable length in between
  const shortLen = minLen + 1.6;
  if (prev.index > 0 && prev.len < shortLen && len < shortLen) len = shortLen + R() * 1.0;
  track.themeLeft--;
  if (track.themeLeft <= 0) {
    let n; do { n = (R() * THEMES.length) | 0; } while (n === track.themeIdx);
    track.themeIdx = n; track.themeLeft = 9 + ((R() * 7) | 0);
  }
  let wave = null;
  const waveRoll = R();
  if (len >= 7 && (lvl ? waveRoll < lvl.waveP : dist > 220 && waveRoll < 0.22 + d * 0.2)) {
    wave = { n: len > 10 ? 2 : 1, A: (0.45 + R() * 0.4) * (R() < 0.35 ? -1 : 1) };
  }
  const seg = addSegment(new Segment(prev.index + 1, prev.ex, prev.ez, 1 - prev.dir, len, track.themeIdx, { wave }));
  seg.pathStart = pathStart;
  // coins
  const coinChance = (runState.coinRush ? 0.62 : 0.42);
  if (R() < coinChance && len >= 4.2) {
    const n = len > 8 ? 4 : 3;
    const lat = [-0.75, 0, 0.75][(R() * 3) | 0];
    const mid = ROAD_W / 2 + (len - ROAD_W / 2) * (0.35 + R() * 0.2);
    for (let i = 0; i < n; i++) {
      const s = mid + (i - (n - 1) / 2) * 0.85;
      if (s < ROAD_W / 2 + 0.3 || s > len - 1.2) continue;
      const m = makeCoin();
      const y = seg.height(s) + 0.42;
      m.position.set(seg.wx(s, lat), y, seg.wz(s, lat));
      seg.group.add(m);
      seg.coins.push({ mesh: m, x: m.position.x, y, z: m.position.z, taken: false, phase: i * 0.5 });
      track.coinTotal++;
    }
  }
  return seg;
}

function makeFinish(prev, pathStart) {
  const seg = addSegment(new Segment(prev.index + 1, prev.ex, prev.ez, 1 - prev.dir, 18, track.themeIdx, {}));
  seg.pathStart = pathStart;
  seg.finish = true;
  seg.finishS = ROAD_W / 2 + 2.6;
  track.finishSeg = seg;
  const fs = seg.finishS, hw = ROAD_W / 2;
  // chequered line painted on the road
  const line = new T.Mesh(new T.PlaneGeometry(0.7, ROAD_W), new T.MeshLambertMaterial({ map: finishTex, polygonOffset: true, polygonOffsetFactor: -1 }));
  line.rotation.x = -HALF_PI;
  line.rotation.z = seg.dir === 1 ? 0 : HALF_PI;
  line.position.set(seg.wx(fs, 0), 0.012, seg.wz(fs, 0));
  line.receiveShadow = true;
  seg.group.add(line);
  // arch
  const arch = new T.Group();
  arch.position.set(seg.wx(fs, 0), 0, seg.wz(fs, 0));
  arch.rotation.y = seg.ang;
  const pillarM = new T.MeshPhongMaterial({ color: 0xff2e9a, flatShading: true, shininess: 50 });
  const stripeM = new T.MeshPhongMaterial({ color: 0xffd400, flatShading: true });
  for (const s of [-1, 1]) {
    const p = new T.Mesh(unitBoxR, pillarM); p.scale.set(0.22, 1.9, 0.22); p.position.set(0, 0.95, s * (hw + 0.2)); p.castShadow = true; arch.add(p);
    for (let i = 0; i < 4; i++) { const b = new T.Mesh(unitBoxR, stripeM); b.scale.set(0.24, 0.1, 0.24); b.position.set(0, 0.3 + i * 0.42, s * (hw + 0.2)); arch.add(b); }
    const ball = new T.Mesh(new T.SphereGeometry(0.17, 12, 8), stripeM); ball.position.set(0, 2.05, s * (hw + 0.2)); arch.add(ball);
  }
  const bannerM = new T.MeshLambertMaterial({ map: finishTex });
  const banner = new T.Mesh(unitBoxR, [pillarM, pillarM, pillarM, pillarM, bannerM, bannerM]);
  banner.scale.set(0.12, 0.42, ROAD_W + 0.6); banner.position.set(0, 1.72, 0); banner.castShadow = true;
  banner.material = [bannerM, bannerM, pillarM, pillarM, pillarM, pillarM];
  arch.add(banner);
  seg.group.add(arch);
  seg.arch = arch;
  return seg;
}

/* =========================================================================
 * Car models — an original, procedurally built lineup
 * ========================================================================= */
const matCache = new Map();
const GLASS = '#2f4258';
const TIRE = '#24232b';
function mat(color, emissive, ei) {
  const key = color + '|' + (emissive || '') + '|' + (ei || 0);
  let m = matCache.get(key);
  if (!m) {
    const glass = color === GLASS, tire = color === TIRE;
    m = new T.MeshPhongMaterial({
      color, flatShading: true,
      shininess: glass ? 90 : tire ? 6 : 42,
      specular: glass ? 0x8aa0b8 : tire ? 0x050505 : 0x2c2c2c
    });
    if (emissive) { m.emissive = new T.Color(emissive); m.emissiveIntensity = ei || 1; }
    matCache.set(key, m);
  }
  return m;
}
// a material owned by one car, for parts that animate their colour or glow
function ownMat(color, emissive, ei, extra) {
  return new T.MeshPhongMaterial(Object.assign({ color, flatShading: true, shininess: 42, specular: 0x2c2c2c, emissive: emissive || 0x000000, emissiveIntensity: ei || 0 }, extra || {}));
}
const unitBox = new T.BoxGeometry(1, 1, 1);
const geoCache = new Map();
function cylGeo(rt, rb, h, seg) {
  const key = [rt, rb, h, seg].join('|');
  let g = geoCache.get(key);
  if (!g) { g = new T.CylinderGeometry(rt, rb, h, seg); geoCache.set(key, g); }
  return g;
}

/* Car construction kit. Everything except the wheels goes into `body`, so the
 * suspension can bounce and lean the body while the wheels stay planted. */
function kit(group) {
  const body = new T.Group();
  group.add(body);
  const k = { g: group, body, wheels: [], steer: [], flash: [], anims: [], tails: [], L: 1.1, exhaust: null, hover: false, bob: Math.random() * 6 };
  k.box = (w, h, d, c, x, y, z, o) => {
    o = o || {};
    const m = new T.Mesh(unitBox, o.m || mat(c, o.e, o.ei));
    m.scale.set(w, h, d); m.position.set(x, y, z);
    if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz;
    m.castShadow = true;
    (o.parent || body).add(m);
    return m;
  };
  k.cyl = (rt, rb, h, c, x, y, z, o) => {
    o = o || {};
    const m = new T.Mesh(cylGeo(rt, rb, h, o.seg || 12), o.m || mat(c, o.e, o.ei));
    m.position.set(x, y, z);
    if (o.axis === 'x') m.rotation.z = HALF_PI;
    if (o.axis === 'z') m.rotation.x = HALF_PI;
    if (o.rx) m.rotation.x += o.rx; if (o.rz) m.rotation.z += o.rz;
    m.castShadow = true;
    (o.parent || body).add(m);
    return m;
  };
  k.sphere = (r, c, x, y, z, sx, sy, sz, o) => {
    o = o || {};
    const key = 'sph' + (o.half ? 'h' : '') + (o.seg || 10);
    let g = geoCache.get(key);
    if (!g) { g = o.half ? new T.SphereGeometry(1, o.seg || 10, 6, 0, TAU, 0, HALF_PI) : new T.SphereGeometry(1, o.seg || 10, 7); geoCache.set(key, g); }
    const m = new T.Mesh(g, o.m || mat(c, o.e, o.ei));
    m.scale.set(r * (sx || 1), r * (sy || 1), r * (sz || 1)); m.position.set(x, y, z);
    m.castShadow = true;
    (o.parent || body).add(m);
    return m;
  };
  k.group = (x, y, z, parent) => { const g = new T.Group(); g.position.set(x, y, z); (parent || body).add(g); return g; };
  k.wheel = (x, z, r, w, front, o) => {
    o = o || {};
    const holder = new T.Group(); holder.position.set(x, r, z);
    const spin = new T.Group(); holder.add(spin);
    k.cyl(r, r, w, o.tire || TIRE, 0, 0, 0, { axis: 'z', seg: 16, parent: spin });
    if (o.wall) k.cyl(r * 0.8, r * 0.8, w + 0.006, o.wall, 0, 0, 0, { axis: 'z', seg: 16, parent: spin });
    k.cyl(r * 0.62, r * 0.62, w + 0.012, o.hub || '#d9dce6', 0, 0, 0, { axis: 'z', seg: 10, parent: spin });
    k.box(r * 1.08, r * 0.15, w + 0.02, o.hub2 || '#8b8f9c', 0, 0, 0, { parent: spin });
    k.box(r * 1.08, r * 0.15, w + 0.02, o.hub2 || '#8b8f9c', 0, 0, 0, { parent: spin, rz: HALF_PI });
    k.cyl(r * 0.2, r * 0.2, w + 0.03, o.cap || '#5a5e6a', 0, 0, 0, { axis: 'z', seg: 8, parent: spin });
    group.add(holder);
    k.wheels.push({ spin, r });
    if (front) k.steer.push(holder);
    return holder;
  };
  k.wheels4 = (fx, rx, track, r, w, o) => {
    for (const s of [-1, 1]) { k.wheel(fx, s * track, r, w, true, o); k.wheel(-rx, s * track, r, w, false, o); }
  };
  k.tail = (w, h, d, x, y, z) => {
    const m = ownMat('#ff2a40', '#ff1030', 0.6);
    k.tails.push(m);
    return k.box(w, h, d, '', x, y, z, { m });
  };
  k.lights = (x, y, z, o) => { // front & rear lights at +-x, +-z
    o = o || {};
    const hw = o.w || 0.1, hh = o.h || 0.055;
    k.box(0.02, hh, hw, '#fffbe6', x + 0.008, y, z, { e: '#fff1a8', ei: 0.9 });
    k.box(0.02, hh, hw, '#fffbe6', x + 0.008, y, -z, { e: '#fff1a8', ei: 0.9 });
    const rx = o.rx !== undefined ? o.rx : -x;
    k.tail(0.02, hh, hw, rx - 0.008, o.ry || y, z);
    k.tail(0.02, hh, hw, rx - 0.008, o.ry || y, -z);
  };
  k.flasher = (w, h, d, x, y, z, a, b, phase, parent) => {
    const m = k.box(w, h, d, a, x, y, z, { m: new T.MeshLambertMaterial({ color: a, emissive: a, emissiveIntensity: 0.9 }), parent });
    k.flash.push({ m, a: new T.Color(a), b: new T.Color(b), phase: phase || 0 });
    return m;
  };
  k.pipe = (x, y, z) => { // exhaust pipe; puffs come out of the last one added
    k.cyl(0.025, 0.025, 0.08, '#8b8f9c', x, y, z, { axis: 'x', seg: 8 });
    k.exhaust = [x - 0.05, y, z];
  };
  return k;
}

// A boxy hatch / sedan base used by many cars
function baseCar(k, o) {
  const L = o.L || 1.1, W = o.W || 0.6, r = o.r || 0.14, y0 = o.y0 || 0.085, bh = o.bh || 0.24;
  const cl = o.cl || 0.56, cx = o.cx !== undefined ? o.cx : -0.07, ch = o.ch || 0.23, cw = o.cw || W * 0.84;
  const top = y0 + bh;
  k.L = L;
  k.box(L, bh, W, o.color, 0, y0 + bh / 2, 0);
  k.box(L * 0.995, 0.05, W + 0.012, o.trim || '#2a2a34', 0, y0 + 0.03, 0);
  if (!o.noCabin) {
    k.box(cl, ch, cw, o.roof || o.color, cx, top + ch / 2, 0);
    k.box(cl + 0.016, ch * 0.52, cw + 0.016, o.glass || GLASS, cx, top + ch * 0.46, 0);
    if (!o.noMirrors) for (const s of [-1, 1]) k.box(0.05, 0.04, 0.05, o.mirror || o.color, cx + cl / 2 - 0.03, top + 0.03, s * (cw / 2 + 0.035));
  }
  k.box(0.012, bh * 0.32, W * 0.42, o.grille || '#1d1d24', L / 2 + 0.004, y0 + bh * 0.42, 0);
  k.box(0.05, 0.07, W * 0.96, o.bumper || '#33333d', L / 2 + 0.02, y0 + 0.05, 0);
  k.box(0.05, 0.07, W * 0.96, o.bumper || '#33333d', -L / 2 - 0.02, y0 + 0.05, 0);
  k.lights(L / 2, y0 + bh * 0.66, W * 0.32);
  k.pipe(-L / 2 - 0.03, y0 + 0.04, -W * 0.27);
  k.wheels4(o.fx || L * 0.32, o.rx || L * 0.32, W / 2 - 0.03, r, o.ww || 0.13, o.wheel);
  return { L, W, r, y0, bh, top, cl, cx, ch, cw };
}
function stripes(k, d, color, gap, width) {
  gap = gap || 0.07; width = width || 0.055;
  for (const s of [-1, 1]) {
    k.box(d.L + 0.004, 0.006, width, color, 0, d.top + 0.003, s * gap);
    k.box(d.cl + 0.004, 0.006, width, color, d.cx, d.top + d.ch + 0.003, s * gap);
    k.box(0.006, d.bh * 0.9, width, color, d.L / 2 + 0.002, d.y0 + d.bh / 2 + 0.01, s * gap);
    k.box(0.006, d.bh * 0.9, width, color, -d.L / 2 - 0.002, d.y0 + d.bh / 2 + 0.01, s * gap);
  }
}
function spoiler(k, x, y, w, c, post) {
  k.box(0.04, 0.09, 0.04, post || '#22222a', x, y + 0.045, w * 0.32);
  k.box(0.04, 0.09, 0.04, post || '#22222a', x, y + 0.045, -w * 0.32);
  k.box(0.16, 0.025, w * 1.02, c, x - 0.01, y + 0.1, 0);
}
function beacon(k, x, y, z, color) { // rotating warning light
  k.cyl(0.05, 0.055, 0.03, '#2a2a34', x, y + 0.015, z, { seg: 10 });
  k.cyl(0.04, 0.04, 0.06, color, x, y + 0.06, z, { seg: 10, m: new T.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.5, transparent: true, opacity: 0.85 }) });
  const rot = k.group(x, y + 0.06, z);
  k.box(0.07, 0.035, 0.02, color, 0.02, 0, 0, { parent: rot, m: new T.MeshBasicMaterial({ color: 0xffffff }) });
  k.anims.push((c, dt) => { rot.rotation.y += dt * 9; });
}

const CARS = [
  { id: 'rookie', name: 'Rookie', price: 0, tier: 0, desc: 'Trusty green hatch with twin racing stripes.',
    build(k) { const d = baseCar(k, { color: '#3cc24a' }); stripes(k, d, '#ffffff'); } },
  { id: 'cherry', name: 'Cherry Pop', price: 60, tier: 0, desc: 'Small, red and always in a hurry.',
    build(k) { const d = baseCar(k, { color: '#e8333f', roof: '#26232c', cl: 0.62, cx: -0.12 }); spoiler(k, -d.L / 2 + 0.06, d.top + d.ch - 0.02, d.W * 0.8, '#26232c'); } },
  { id: 'citrus', name: 'Citrus Cab', price: 100, tier: 0, desc: 'Yellow city cab with a roof sign.',
    build(k) {
      const d = baseCar(k, { color: '#ffc626', L: 1.18 });
      for (let i = 0; i < 10; i++) k.box(0.052, 0.04, d.W + 0.014, i % 2 ? '#1d1d24' : '#ffffff', -0.26 + i * 0.052, d.y0 + d.bh * 0.55, 0);
      k.box(0.2, 0.07, 0.14, '#fff3c4', d.cx, d.top + d.ch + 0.035, 0, { e: '#ffcc33', ei: 0.4 });
      k.box(0.18, 0.04, 0.15, '#1d1d24', d.cx, d.top + d.ch + 0.035, 0);
    } },
  { id: 'pocket', name: 'Pocket', price: 120, tier: 0, desc: 'Tiny city car. Parks anywhere, drifts everywhere.',
    build(k) {
      const d = baseCar(k, { color: '#62e3c0', L: 0.9, W: 0.56, cl: 0.5, cx: -0.06, ch: 0.27, r: 0.13, roof: '#ffffff', mirror: '#ffffff' });
      k.box(0.2, 0.012, d.W + 0.012, '#ffffff', 0.26, d.y0 + d.bh * 0.7, 0);
      k.cyl(0.035, 0.035, 0.015, '#fffbe6', d.L / 2 + 0.005, d.y0 + d.bh * 0.66, 0.16, { axis: 'x', seg: 10, e: '#fff1a8', ei: 0.9 });
      k.cyl(0.035, 0.035, 0.015, '#fffbe6', d.L / 2 + 0.005, d.y0 + d.bh * 0.66, -0.16, { axis: 'x', seg: 10, e: '#fff1a8', ei: 0.9 });
    } },
  { id: 'patrol', name: 'Patrol', price: 150, tier: 1, desc: 'Lights on. Sirens optional.',
    build(k) {
      const d = baseCar(k, { color: '#1d2235', L: 1.18, roof: '#f4f4f8' });
      k.box(0.46, d.bh * 0.7, d.W + 0.012, '#f4f4f8', -0.04, d.y0 + d.bh * 0.5, 0);
      k.box(0.07, 0.04, d.cw * 0.95, '#2a2a34', d.cx, d.top + d.ch + 0.02, 0);
      k.flasher(0.08, 0.05, d.cw * 0.45, d.cx, d.top + d.ch + 0.05, d.cw * 0.24, '#ff2b3a', '#3a0508', 0);
      k.flasher(0.08, 0.05, d.cw * 0.45, d.cx, d.top + d.ch + 0.05, -d.cw * 0.24, '#2b6bff', '#05123a', 0.5);
    } },
  { id: 'tuktuk', name: 'Tuk-Tuk', price: 180, tier: 1, desc: 'Three wheels, one canopy, zero brakes.',
    build(k) {
      k.L = 0.95;
      const c = '#ffcc1a', can = '#14a85a';
      k.box(0.9, 0.08, 0.5, '#1d1d24', -0.02, 0.17, 0);
      k.box(0.24, 0.3, 0.32, c, 0.34, 0.34, 0);
      k.box(0.02, 0.2, 0.28, GLASS, 0.31, 0.6, 0, { rz: -0.2 });
      k.box(0.5, 0.28, 0.6, c, -0.18, 0.35, 0);
      k.box(0.16, 0.16, 0.5, '#e8303d', -0.2, 0.55, 0);
      for (const sx of [0.3, -0.42]) for (const s of [-1, 1]) k.box(0.025, 0.3, 0.025, '#1d1d24', sx, 0.62, s * 0.28);
      k.box(0.86, 0.05, 0.66, can, -0.05, 0.79, 0);
      k.box(0.86, 0.02, 0.06, '#ffffff', -0.05, 0.815, 0);
      const fringe = k.group(-0.05, 0.76, 0);
      for (let i = 0; i < 9; i++) for (const s of [-1, 1]) k.box(0.06, 0.05, 0.012, i % 2 ? '#ff4f81' : '#ffd23f', -0.4 + i * 0.1, -0.03, s * 0.335, { parent: fringe });
      k.cyl(0.04, 0.04, 0.02, '#fffbe6', 0.47, 0.42, 0, { axis: 'x', seg: 10, e: '#fff1a8', ei: 0.9 });
      k.tail(0.02, 0.05, 0.08, -0.44, 0.3, 0.2); k.tail(0.02, 0.05, 0.08, -0.44, 0.3, -0.2);
      k.pipe(-0.45, 0.16, -0.2);
      k.wheel(0.38, 0, 0.12, 0.1, true);
      k.wheel(-0.3, 0.3, 0.13, 0.11, false); k.wheel(-0.3, -0.3, 0.13, 0.11, false);
      k.anims.push((c, dt) => { fringe.rotation.x = damp(fringe.rotation.x, -c.lean * 1.4 + Math.sin(c.t * 11) * 0.06 * Math.min(1, c.speed / 6), 10, dt); });
    } },
  { id: 'medic', name: 'Medic Van', price: 200, tier: 1, desc: 'Tall, white and surprisingly nimble.',
    build(k) {
      const d = baseCar(k, { color: '#f6f6fa', L: 1.26, cl: 0.98, cx: -0.12, ch: 0.36, cw: 0.6, W: 0.62, roof: '#f6f6fa', glass: '#f6f6fa' });
      k.box(0.2, 0.17, d.cw + 0.016, GLASS, d.cx + d.cl / 2 - 0.1, d.top + 0.2, 0);
      k.box(d.cl * 0.66, 0.07, d.cw + 0.014, '#e8303d', d.cx - d.cl * 0.12, d.top + 0.1, 0);
      k.box(d.L + 0.01, 0.05, d.W + 0.012, '#e8303d', 0, d.y0 + d.bh * 0.55, 0);
      k.box(0.06, 0.18, 0.06, '#e8303d', d.cx - 0.15, d.top + d.ch + 0.012, 0);
      k.box(0.18, 0.06, 0.06, '#e8303d', d.cx - 0.15, d.top + d.ch + 0.012, 0);
      k.flasher(0.07, 0.05, 0.16, d.cx + d.cl / 2 - 0.08, d.top + d.ch + 0.03, 0.12, '#ff2b3a', '#3a0508', 0);
      k.flasher(0.07, 0.05, 0.16, d.cx + d.cl / 2 - 0.08, d.top + d.ch + 0.03, -0.12, '#2b6bff', '#05123a', 0.5);
    } },
  { id: 'scoops', name: 'Scoops', price: 250, tier: 1, desc: 'An ice-cream van that refuses to slow down.',
    build(k) {
      const d = baseCar(k, { color: '#ff9fc8', L: 1.22, cl: 0.94, cx: -0.1, ch: 0.34, cw: 0.6, roof: '#bff4e2', glass: '#bff4e2' });
      k.box(0.18, 0.16, d.cw + 0.016, GLASS, d.cx + d.cl / 2 - 0.09, d.top + 0.19, 0);
      for (let i = 0; i < 6; i++) k.box(0.11, 0.035, 0.08, i % 2 ? '#ffffff' : '#ff6fa8', d.cx - 0.3 + i * 0.1, d.top + 0.2, d.cw / 2 + 0.045, { rx: -0.5 });
      const cone = k.group(d.cx - 0.1, d.top + d.ch, 0);
      k.cyl(0.075, 0.0, 0.2, '#e3a35a', 0, 0.11, 0, { seg: 8, parent: cone });
      k.sphere(0.09, '#ffe6f2', 0, 0.22, 0, 1, 1, 1, { parent: cone });
      k.sphere(0.03, '#e8333f', 0, 0.31, 0, 1, 1, 1, { parent: cone });
      k.anims.push((c, dt) => { cone.rotation.y += dt * 1.6; cone.rotation.x = damp(cone.rotation.x, -c.lean * 0.8, 8, dt); });
    } },
  { id: 'brick', name: 'Parcel Box', price: 300, tier: 1, desc: 'Delivers on time, every time.',
    build(k) {
      const d = baseCar(k, { color: '#8a5a2b', L: 1.28, cl: 0.3, cx: 0.34, ch: 0.24, cw: 0.56, roof: '#c98e4e' });
      k.box(0.78, 0.44, 0.64, '#c98e4e', -0.22, d.top + 0.2, 0);
      k.box(0.3, 0.12, 0.66, '#f4e2c4', -0.22, d.top + 0.24, 0);
      k.box(0.012, 0.36, 0.5, '#6e461f', -0.61, d.top + 0.18, 0);
    } },
  { id: 'fury', name: 'Fury', price: 350, tier: 2, desc: 'Big engine, bigger stripes.',
    build(k) {
      const d = baseCar(k, { color: '#ff7a1a', L: 1.22, W: 0.64, cl: 0.46, cx: -0.12, ch: 0.2, r: 0.15, ww: 0.15 });
      stripes(k, d, '#1d1d24', 0.06, 0.07);
      k.box(0.22, 0.06, 0.22, '#1d1d24', 0.3, d.top + 0.03, 0);
      spoiler(k, -d.L / 2 + 0.06, d.top, d.W * 0.85, '#1d1d24');
      k.pipe(-d.L / 2 - 0.03, d.y0 + 0.04, d.W * 0.27);
    } },
  { id: 'ducky', name: 'Quackers', price: 360, tier: 2, desc: 'A sky-blue cruiser with a rubber duck co-pilot.',
    build(k) {
      const d = baseCar(k, { color: '#4fc3f7', L: 1.12, cl: 0.52, roof: '#ffffff', mirror: '#ffffff' });
      const duck = k.group(d.cx - 0.02, d.top + d.ch, 0);
      k.sphere(0.13, '#ffd21f', 0, 0.08, 0, 1.25, 0.8, 1, { parent: duck, seg: 12 });
      k.box(0.08, 0.05, 0.16, '#ffd21f', -0.15, 0.13, 0, { parent: duck, rz: 0.6 });
      const head = k.group(0.1, 0.17, 0, duck);
      k.sphere(0.075, '#ffd21f', 0, 0.06, 0, 1, 1, 1, { parent: head, seg: 12 });
      k.box(0.08, 0.025, 0.07, '#ff8a1f', 0.08, 0.05, 0, { parent: head });
      for (const s of [-1, 1]) k.box(0.02, 0.025, 0.02, '#1d1d24', 0.055, 0.085, s * 0.04, { parent: head });
      k.anims.push((c, dt) => {
        head.rotation.z = Math.sin(c.t * 5) * 0.18 + c.accel * 0.03;
        head.position.y = 0.17 + Math.abs(Math.sin(c.t * 5)) * 0.015;
        duck.rotation.x = damp(duck.rotation.x, -c.lean * 0.9, 8, dt);
      });
    } },
  { id: 'pizza', name: 'Pizza Rush', price: 380, tier: 2, desc: 'Thirty minutes or it\'s free. It\'s never free.',
    build(k) {
      const d = baseCar(k, { color: '#e8303d', L: 1.08, roof: '#ffffff', cl: 0.54, mirror: '#ffffff' });
      k.box(d.L + 0.012, 0.05, d.W + 0.012, '#ffffff', 0, d.y0 + d.bh * 0.55, 0);
      k.box(0.03, 0.08, 0.03, '#2a2a34', d.cx, d.top + d.ch + 0.04, 0);
      const sign = k.group(d.cx, d.top + d.ch + 0.2, 0);
      k.cyl(0.15, 0.15, 0.03, '#e8a33c', 0, 0, 0, { axis: 'z', seg: 16, parent: sign });
      k.cyl(0.125, 0.125, 0.036, '#ffd84a', 0, 0, 0, { axis: 'z', seg: 16, parent: sign });
      [[0.05, 0.04], [-0.05, 0.05], [0.0, -0.06], [0.07, -0.04], [-0.06, -0.03]].forEach(([a, b]) => {
        k.cyl(0.022, 0.022, 0.044, '#c0242e', a, b, 0, { axis: 'z', seg: 8, parent: sign });
      });
      k.anims.push((c, dt) => { sign.rotation.y += dt * (2 + c.speed * 0.15); });
    } },
  { id: 'rally', name: 'Gravel King', price: 400, tier: 2, desc: 'Rally-bred with a light pod and mudflaps.',
    build(k) {
      const d = baseCar(k, { color: '#f4f6fb', L: 1.14, r: 0.15, y0: 0.11, roof: '#1f6cf0' });
      k.box(d.L + 0.01, d.bh * 0.45, d.W + 0.012, '#1f6cf0', 0, d.y0 + d.bh * 0.25, 0);
      k.box(0.16, 0.05, 0.18, '#1d1d24', d.cx, d.top + d.ch + 0.025, 0);
      for (let i = 0; i < 4; i++) k.cyl(0.035, 0.035, 0.02, '#fff7c2', d.L / 2 - 0.02, d.top + 0.03, -0.2 + i * 0.133, { axis: 'x', seg: 8, e: '#ffe066', ei: 0.9 });
      const flaps = [];
      for (const s of [-1, 1]) {
        const f = k.group(-d.L * 0.32 - 0.12, d.y0 + 0.07, s * (d.W / 2 - 0.05));
        k.box(0.012, 0.1, 0.12, '#e8303d', 0, -0.05, 0, { parent: f });
        flaps.push(f);
      }
      spoiler(k, -d.L / 2 + 0.06, d.top + d.ch - 0.03, d.W * 0.8, '#1f6cf0');
      k.anims.push((c, dt) => { flaps.forEach((f, i) => { f.rotation.z = Math.min(0.9, c.speed * 0.04) + Math.sin(c.t * 17 + i) * 0.08 * Math.min(1, c.speed / 6); }); });
    } },
  { id: 'trail', name: 'Trailblazer', price: 450, tier: 2, desc: 'Open-top off-roader with a spare.',
    build(k) {
      const d = baseCar(k, { color: '#6f8b3a', L: 1.12, r: 0.17, y0: 0.14, bh: 0.24, noCabin: true, ww: 0.15 });
      k.box(0.03, 0.18, d.W * 0.9, GLASS, 0.12, d.top + 0.09, 0, { rz: -0.25 });
      k.box(0.04, 0.2, 0.04, '#26262e', -0.25, d.top + 0.1, d.W / 2 - 0.05);
      k.box(0.04, 0.2, 0.04, '#26262e', -0.25, d.top + 0.1, -d.W / 2 + 0.05);
      k.box(0.04, 0.04, d.W - 0.06, '#26262e', -0.25, d.top + 0.2, 0);
      k.box(0.14, 0.14, 0.18, '#3d3d46', -0.1, d.top + 0.07, 0.12);
      k.box(0.14, 0.14, 0.18, '#3d3d46', -0.1, d.top + 0.07, -0.12);
      k.cyl(0.13, 0.13, 0.08, TIRE, -d.L / 2 - 0.06, d.top - 0.04, 0, { axis: 'x', seg: 12 });
      k.box(0.06, 0.06, d.W * 0.9, '#3d3d46', d.L / 2 - 0.02, d.top + 0.03, 0);
    } },
  { id: 'hauler', name: 'Hauler', price: 450, tier: 2, desc: 'Pickup truck with a bed full of attitude.',
    build(k) {
      const d = baseCar(k, { color: '#19b3b1', L: 1.26, r: 0.16, y0: 0.12, cl: 0.38, cx: 0.06, ch: 0.25 });
      const bx = -0.36, bw = 0.5;
      k.box(bw, 0.12, 0.035, '#128f8d', bx, d.top + 0.06, d.W / 2 - 0.02);
      k.box(bw, 0.12, 0.035, '#128f8d', bx, d.top + 0.06, -d.W / 2 + 0.02);
      k.box(0.035, 0.12, d.W - 0.02, '#128f8d', -d.L / 2 + 0.02, d.top + 0.06, 0);
      k.box(bw - 0.04, 0.01, d.W - 0.06, '#1d1d24', bx, d.top + 0.005, 0);
      k.box(0.06, 0.04, d.cw * 0.9, '#26262e', d.cx, d.top + d.ch + 0.02, 0);
    } },
  { id: 'woody', name: 'Woody', price: 500, tier: 2, desc: 'Retro wagon, surfboard included.',
    build(k) {
      const d = baseCar(k, { color: '#f3e3c3', L: 1.24, cl: 0.78, cx: -0.15, ch: 0.24, roof: '#f3e3c3', wheel: { wall: '#f4f4f4' } });
      k.box(d.L * 0.72, d.bh * 0.7, d.W + 0.012, '#a8673a', -0.12, d.y0 + d.bh * 0.5, 0);
      for (let i = 0; i < 4; i++) k.box(0.012, d.bh * 0.72, d.W + 0.016, '#7a4622', -0.5 + i * 0.25, d.y0 + d.bh * 0.5, 0);
      k.box(0.95, 0.03, 0.2, '#4fc3f7', d.cx, d.top + d.ch + 0.04, 0);
      k.box(0.95, 0.032, 0.04, '#ffffff', d.cx, d.top + d.ch + 0.042, 0);
    } },
  { id: 'camper', name: 'Wanderer', price: 540, tier: 2, desc: 'Two-tone camper with the whole holiday on the roof.',
    build(k) {
      const d = baseCar(k, { color: '#1fb3a8', L: 1.2, cl: 1.0, cx: -0.08, ch: 0.32, cw: 0.6, roof: '#fff4dc', glass: '#fff4dc', wheel: { wall: '#f4f4f4' } });
      k.box(0.03, 0.15, d.cw * 0.88, GLASS, d.cx + d.cl / 2 + 0.002, d.top + 0.18, 0);
      for (let i = 0; i < 3; i++) k.box(0.18, 0.13, d.cw + 0.016, GLASS, d.cx + 0.28 - i * 0.26, d.top + 0.18, 0);
      k.box(0.012, 0.12, d.W * 0.7, '#fff4dc', d.L / 2 + 0.006, d.y0 + d.bh * 0.6, 0, { rx: 0 });
      k.box(0.7, 0.03, 0.5, '#2a2a34', d.cx - 0.05, d.top + d.ch + 0.02, 0);
      k.box(0.22, 0.1, 0.2, '#ff8a2b', d.cx + 0.1, d.top + d.ch + 0.08, 0.1);
      k.box(0.18, 0.08, 0.18, '#ffd23f', d.cx - 0.15, d.top + d.ch + 0.07, -0.08);
      k.box(0.14, 0.12, 0.16, '#e8303d', d.cx - 0.3, d.top + d.ch + 0.09, 0.12);
    } },
  { id: 'blaze', name: 'Blaze Engine', price: 600, tier: 3, desc: 'Fire engine with a full-length ladder.',
    build(k) {
      const L = 1.62;
      const d = baseCar(k, { color: '#e0262f', L, W: 0.64, r: 0.15, y0: 0.11, bh: 0.3, cl: 0.32, cx: L / 2 - 0.2, ch: 0.24, roof: '#f2f2f6', fx: L * 0.36, rx: L * 0.3 });
      k.wheel(-L * 0.12, d.W / 2 - 0.03, 0.15, 0.13, false); k.wheel(-L * 0.12, -d.W / 2 + 0.03, 0.15, 0.13, false);
      k.box(1.0, 0.12, 0.58, '#c21c25', -0.26, d.top + 0.06, 0);
      for (const s of [-1, 1]) k.box(1.05, 0.035, 0.035, '#d8dbe4', -0.22, d.top + 0.17, s * 0.16);
      for (let i = 0; i < 9; i++) k.box(0.025, 0.025, 0.32, '#d8dbe4', -0.7 + i * 0.12, d.top + 0.17, 0);
      for (let i = 0; i < 3; i++) k.box(0.2, 0.08, 0.012, '#9a9fae', -0.6 + i * 0.25, d.y0 + d.bh * 0.55, d.W / 2 + 0.006);
      k.flasher(0.07, 0.05, 0.18, d.cx, d.top + d.ch + 0.03, 0.13, '#ff2b3a', '#3a0508', 0);
      k.flasher(0.07, 0.05, 0.18, d.cx, d.top + d.ch + 0.03, -0.13, '#ffb020', '#3a2005', 0.5);
    } },
  { id: 'scholar', name: 'Scholar', price: 650, tier: 3, desc: 'A school bus with something to prove.',
    build(k) {
      const L = 1.74;
      const d = baseCar(k, { color: '#ffbd1f', L, W: 0.64, r: 0.15, y0: 0.1, bh: 0.26, cl: 1.5, cx: -0.1, ch: 0.34, cw: 0.62, roof: '#ffbd1f', glass: '#ffbd1f', fx: L * 0.36, rx: L * 0.33 });
      for (let i = 0; i < 8; i++) k.box(0.13, 0.15, d.cw + 0.016, GLASS, d.cx - 0.66 + i * 0.165, d.top + 0.17, 0);
      k.box(0.03, 0.16, d.cw * 0.86, GLASS, d.cx + d.cl / 2 + 0.002, d.top + 0.17, 0);
      k.box(L + 0.012, 0.025, d.W + 0.014, '#1d1d24', 0, d.y0 + d.bh * 0.55, 0);
      k.box(L + 0.012, 0.025, d.W + 0.014, '#1d1d24', 0, d.y0 + d.bh * 0.85, 0);
      const stop = k.group(0.5, d.y0 + d.bh * 0.55, -d.W / 2 - 0.01);
      k.box(0.2, 0.18, 0.012, '#e8303d', 0.1, 0, 0, { parent: stop });
      k.anims.push((c, dt) => { stop.rotation.y = damp(stop.rotation.y, c.speed < 1 ? -1.2 : 0, 5, dt); });
    } },
  { id: 'tow', name: 'Hook Line', price: 680, tier: 3, desc: 'Tow truck with a hook that swings into every drift.',
    build(k) {
      const d = baseCar(k, { color: '#ff9f1c', L: 1.3, W: 0.62, r: 0.15, y0: 0.11, cl: 0.4, cx: 0.22, ch: 0.26, roof: '#ff9f1c' });
      k.box(0.6, 0.06, d.W - 0.04, '#2a2a34', -0.32, d.top + 0.03, 0);
      k.box(0.1, 0.24, 0.1, '#3d3d46', -0.18, d.top + 0.12, 0);
      k.box(0.6, 0.06, 0.06, '#3d3d46', -0.42, d.top + 0.31, 0, { rz: -0.35 });
      const hook = k.group(-0.7, d.top + 0.2, 0);
      k.box(0.012, 0.22, 0.012, '#9aa0ad', 0, -0.11, 0, { parent: hook });
      k.box(0.06, 0.03, 0.03, '#26262e', 0, -0.23, 0, { parent: hook });
      k.box(0.03, 0.08, 0.03, '#26262e', 0.025, -0.27, 0, { parent: hook });
      beacon(k, d.cx, d.top + d.ch, 0, '#ff9f1c');
      let sw = 0, sv = 0;
      k.anims.push((c, dt) => {
        // damped pendulum driven by drift and acceleration
        sv += (-sw * 40 - sv * 2.5 + c.lean * 30) * dt; sw += sv * dt;
        hook.rotation.x = clamp(sw, -0.9, 0.9);
        hook.rotation.z = damp(hook.rotation.z, -c.accel * 0.05 - Math.min(0.35, c.speed * 0.025), 4, dt);
      });
    } },
  { id: 'frank', name: 'Frank Furter', price: 700, tier: 3, desc: 'Hot dog on the roof. Hot tyres on the road.',
    build(k) {
      const d = baseCar(k, { color: '#ffcf3a', L: 1.18, cl: 0.4, cx: 0.22, roof: '#e8303d' });
      const bun = k.cyl(0.13, 0.13, 0.9, '#e7a55a', -0.12, d.top + 0.13, 0, { axis: 'x', seg: 10 });
      bun.scale.set(1, 1, 1.25);
      const dog = new T.Mesh(new T.CapsuleGeometry(0.09, 0.9, 4, 10), mat('#c8432c'));
      dog.rotation.z = HALF_PI; dog.position.set(-0.12, d.top + 0.24, 0); dog.castShadow = true; k.body.add(dog);
      for (let i = 0; i < 5; i++) k.box(0.05, 0.015, 0.1, '#ffd23f', -0.42 + i * 0.15, d.top + 0.335, 0, { ry: i % 2 ? 0.6 : -0.6 });
    } },
  { id: 'plow', name: 'Snow Plough', price: 720, tier: 3, desc: 'Clears the road. Then drifts on it.',
    build(k) {
      const d = baseCar(k, { color: '#f4f6fb', L: 1.24, W: 0.62, r: 0.16, y0: 0.13, cl: 0.46, cx: 0.06, ch: 0.27, roof: '#1f6cf0' });
      k.box(d.L * 0.5, d.bh * 0.5, d.W + 0.012, '#1f6cf0', -0.3, d.y0 + d.bh * 0.3, 0);
      k.box(0.05, 0.22, 0.86, '#ff8a1f', d.L / 2 + 0.16, 0.16, 0, { ry: 0.25, rz: 0.15 });
      for (let i = 0; i < 5; i++) k.box(0.055, 0.04, 0.12, i % 2 ? '#1d1d24' : '#ffd23f', d.L / 2 + 0.17, 0.2, -0.32 + i * 0.16, { ry: 0.25 });
      k.box(0.18, 0.04, 0.04, '#3d3d46', d.L / 2 + 0.06, 0.14, 0.15); k.box(0.18, 0.04, 0.04, '#3d3d46', d.L / 2 + 0.06, 0.14, -0.15);
      beacon(k, d.cx - 0.08, d.top + d.ch, 0.12, '#ffae00');
      beacon(k, d.cx - 0.08, d.top + d.ch, -0.12, '#ffae00');
    } },
  { id: 'bubble', name: 'Bubble', price: 750, tier: 3, desc: 'Rounded retro charm.',
    build(k) {
      const L = 1.04, W = 0.6, r = 0.14, y0 = 0.09;
      k.L = L;
      k.box(L, 0.18, W - 0.04, '#7fc8ff', 0, y0 + 0.09, 0);
      k.sphere(0.5, '#7fc8ff', 0, y0 + 0.16, 0, 1.05, 0.62, 0.6, { half: true, seg: 14 });
      k.sphere(0.5, GLASS, 0, y0 + 0.17, 0, 0.66, 0.52, 0.62, { half: true, seg: 14 });
      k.sphere(0.5, '#7fc8ff', -0.02, y0 + 0.18, 0, 0.52, 0.5, 0.63, { half: true, seg: 14 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.sphere(0.14, '#5fb0ee', sx * 0.32, y0 + 0.16, sz * 0.27, 1.2, 0.8, 0.6, { half: true });
      k.box(0.05, 0.06, W * 0.9, '#d8dbe4', L / 2, y0 + 0.04, 0);
      k.box(0.05, 0.06, W * 0.9, '#d8dbe4', -L / 2, y0 + 0.04, 0);
      k.cyl(0.045, 0.045, 0.02, '#fffbe6', L / 2 - 0.06, y0 + 0.18, 0.2, { axis: 'x', e: '#fff1a8', ei: 0.9 });
      k.cyl(0.045, 0.045, 0.02, '#fffbe6', L / 2 - 0.06, y0 + 0.18, -0.2, { axis: 'x', e: '#fff1a8', ei: 0.9 });
      k.tail(0.02, 0.05, 0.08, -L / 2 - 0.005, y0 + 0.14, 0.2);
      k.tail(0.02, 0.05, 0.08, -L / 2 - 0.005, y0 + 0.14, -0.2);
      k.pipe(-L / 2 - 0.03, y0 + 0.03, -0.18);
      k.wheels4(0.32, 0.32, W / 2 - 0.04, r, 0.12, { hub: '#ffffff', wall: '#f4f4f4' });
    } },
  { id: 'mixer', name: 'Cement Mixer', price: 780, tier: 3, desc: 'The drum never stops. Neither do you.',
    build(k) {
      const L = 1.5;
      const d = baseCar(k, { color: '#3d6fe0', L, W: 0.64, r: 0.15, y0: 0.11, bh: 0.2, cl: 0.32, cx: L / 2 - 0.2, ch: 0.3, roof: '#3d6fe0', fx: L * 0.36, rx: L * 0.3 });
      k.wheel(-L * 0.12, d.W / 2 - 0.03, 0.15, 0.13, false); k.wheel(-L * 0.12, -d.W / 2 + 0.03, 0.15, 0.13, false);
      k.box(0.06, 0.24, 0.3, '#2a2a34', 0.36, d.top + 0.12, 0);
      const pivot = k.group(-0.26, d.top + 0.24, 0);
      pivot.rotation.z = 0.16;
      const drum = k.group(0, 0, 0, pivot);
      k.cyl(0.17, 0.27, 0.42, '#f4f4f8', 0.21, 0, 0, { axis: 'x', seg: 14, parent: drum });
      k.cyl(0.27, 0.12, 0.34, '#f4f4f8', -0.17, 0, 0, { axis: 'x', seg: 14, parent: drum });
      for (let i = 0; i < 4; i++) {
        const a = i * HALF_PI;
        k.box(0.5, 0.05, 0.06, '#ff8a1f', 0.05, Math.cos(a) * 0.235, Math.sin(a) * 0.235, { parent: drum, rx: a + 0.5 });
      }
      k.anims.push((c, dt) => { drum.rotation.x += dt * (1.6 + c.speed * 0.12); });
    } },
  { id: 'velvet', name: 'Velvet Limo', price: 800, tier: 3, desc: 'Stretch. Shine. Slide.',
    build(k) {
      const d = baseCar(k, { color: '#17171f', L: 1.8, cl: 1.26, cx: -0.12, ch: 0.21, r: 0.14, roof: '#17171f', bumper: '#d8dbe4', fx: 0.6, rx: 0.62, wheel: { hub: '#f2f2f6' } });
      k.box(d.L + 0.01, 0.02, d.W + 0.014, '#d8dbe4', 0, d.y0 + d.bh * 0.7, 0);
      for (let i = 0; i < 4; i++) k.box(0.02, d.ch * 0.6, d.cw + 0.03, '#17171f', d.cx - 0.45 + i * 0.3, d.top + d.ch * 0.46, 0);
    } },
  { id: 'kart', name: 'Go-Kart', price: 850, tier: 3, desc: 'Low, light and twitchy.',
    build(k) {
      k.L = 0.9;
      k.box(0.9, 0.06, 0.44, '#7ed321', 0, 0.1, 0);
      k.box(0.2, 0.08, 0.5, '#26262e', 0.4, 0.1, 0);
      k.box(0.24, 0.06, 0.62, '#26262e', -0.4, 0.12, 0);
      k.box(0.18, 0.18, 0.26, '#26262e', -0.12, 0.22, 0);
      k.box(0.06, 0.24, 0.26, '#26262e', -0.21, 0.3, 0);
      k.box(0.14, 0.2, 0.2, '#ff5a1f', -0.08, 0.36, 0);
      const head = k.group(-0.06, 0.53, 0);
      k.sphere(0.1, '#ffd23f', 0, 0, 0, 1, 1, 1, { seg: 12, parent: head });
      k.box(0.06, 0.05, 0.16, GLASS, 0.09, 0.01, 0, { parent: head });
      k.cyl(0.07, 0.07, 0.015, '#26262e', 0.12, 0.33, 0, { axis: 'x', seg: 12, rz: -0.6 });
      k.box(0.3, 0.12, 0.3, '#7ed321', 0.24, 0.16, 0, { rz: -0.2 });
      k.tail(0.02, 0.04, 0.08, -0.52, 0.16, 0.15); k.tail(0.02, 0.04, 0.08, -0.52, 0.16, -0.15);
      k.pipe(-0.5, 0.2, 0.08);
      for (const s of [-1, 1]) { k.wheel(0.33, s * 0.27, 0.11, 0.12, true); k.wheel(-0.33, s * 0.3, 0.13, 0.16, false); }
      k.anims.push((c, dt) => { head.rotation.x = damp(head.rotation.x, -c.lean * 1.2, 10, dt); });
    } },
  { id: 'shark', name: 'Great White', price: 900, tier: 3, desc: 'Fin up. Teeth out. Tail wagging.',
    build(k) {
      const d = baseCar(k, { color: '#6f8fa8', L: 1.2, W: 0.62, cl: 0.5, cx: -0.08, ch: 0.2, roof: '#6f8fa8', trim: '#e9eef3' });
      k.box(d.L + 0.01, d.bh * 0.35, d.W + 0.01, '#e9eef3', 0, d.y0 + d.bh * 0.18, 0);
      k.box(0.2, 0.03, 0.02, '#1d1d24', d.L / 2 - 0.05, d.y0 + d.bh * 0.5, 0.311);
      for (let i = 0; i < 6; i++) k.box(0.012, 0.04, 0.035, '#ffffff', d.L / 2 + 0.008, d.y0 + d.bh * 0.25, -0.18 + i * 0.07, { rx: PI / 4 });
      const fin = k.group(d.cx - 0.05, d.top + d.ch, 0);
      k.box(0.2, 0.18, 0.025, '#5c7a92', -0.03, 0.08, 0, { parent: fin, rz: 0.55 });
      const tail = k.group(-d.L / 2 - 0.02, d.top - 0.02, 0);
      k.box(0.14, 0.04, 0.02, '#5c7a92', -0.06, 0.06, 0, { parent: tail, rz: 0.8 });
      k.box(0.14, 0.04, 0.02, '#5c7a92', -0.06, -0.02, 0, { parent: tail, rz: -0.6 });
      k.anims.push((c, dt) => {
        tail.rotation.y = Math.sin(c.t * (4 + c.speed * 0.4)) * 0.45;
        fin.rotation.x = damp(fin.rotation.x, -c.lean * 0.7, 8, dt);
      });
    } },
  { id: 'sprinter', name: 'Sprinter F', price: 950, tier: 4, desc: 'Open-wheel racer with wings for days.',
    build(k) {
      k.L = 1.3;
      const red = '#e8152b';
      k.box(1.1, 0.13, 0.26, red, 0, 0.16, 0);
      k.box(0.36, 0.1, 0.16, red, 0.62, 0.13, 0);
      k.box(0.14, 0.03, 0.72, '#1d1d24', 0.74, 0.07, 0);
      k.box(0.12, 0.08, 0.02, red, 0.74, 0.1, 0.36); k.box(0.12, 0.08, 0.02, red, 0.74, 0.1, -0.36);
      k.box(0.46, 0.12, 0.5, red, -0.1, 0.15, 0);
      k.box(0.24, 0.16, 0.18, '#1d1d24', 0.02, 0.28, 0);
      k.sphere(0.085, '#ffffff', 0.0, 0.36, 0, 1, 1, 1, { seg: 12 });
      k.box(0.05, 0.05, 0.15, '#26262e', 0.06, 0.37, 0);
      k.box(0.24, 0.22, 0.12, red, -0.32, 0.3, 0);
      k.box(0.18, 0.035, 0.66, '#1d1d24', -0.56, 0.46, 0);
      k.box(0.16, 0.16, 0.02, red, -0.56, 0.4, 0.33); k.box(0.16, 0.16, 0.02, red, -0.56, 0.4, -0.33);
      k.box(0.04, 0.2, 0.04, '#1d1d24', -0.52, 0.33, 0);
      k.tail(0.02, 0.05, 0.1, -0.6, 0.2, 0);
      k.pipe(-0.6, 0.26, 0.06);
      for (const s of [-1, 1]) { k.wheel(0.48, s * 0.32, 0.15, 0.16, true, { hub: '#cfd3dc' }); k.wheel(-0.4, s * 0.33, 0.17, 0.2, false, { hub: '#cfd3dc' }); }
    } },
  { id: 'harvest', name: 'Harvester', price: 1000, tier: 4, desc: 'Farm-fresh drifting.',
    build(k) {
      k.L = 1.15;
      k.box(0.7, 0.2, 0.34, '#2e9e3e', 0.15, 0.3, 0);
      k.box(0.3, 0.12, 0.3, '#2e9e3e', 0.5, 0.26, 0);
      k.box(0.05, 0.14, 0.26, '#26262e', 0.66, 0.26, 0);
      k.box(0.34, 0.36, 0.46, '#2e9e3e', -0.3, 0.52, 0);
      k.box(0.36, 0.22, 0.48, GLASS, -0.3, 0.55, 0);
      k.box(0.4, 0.04, 0.52, '#f4f4f8', -0.3, 0.72, 0);
      k.cyl(0.03, 0.03, 0.34, '#26262e', 0.36, 0.52, 0.1, { seg: 8 });
      const cap = k.group(0.36, 0.7, 0.1);
      k.box(0.07, 0.015, 0.07, '#26262e', 0.03, 0, 0, { parent: cap });
      k.box(0.36, 0.05, 0.62, '#ffc626', -0.3, 0.44, 0);
      k.tail(0.02, 0.05, 0.08, -0.48, 0.42, 0.18); k.tail(0.02, 0.05, 0.08, -0.48, 0.42, -0.18);
      k.exhaust = [0.36, 0.72, 0.1];
      for (const s of [-1, 1]) { k.wheel(0.42, s * 0.24, 0.13, 0.11, true, { hub: '#ffc626' }); k.wheel(-0.32, s * 0.36, 0.27, 0.16, false, { hub: '#ffc626' }); }
      k.anims.push((c, dt) => { cap.rotation.z = Math.abs(Math.sin(c.t * (8 + c.speed))) * 0.9; });
    } },
  { id: 'hotrod', name: 'Hot Rod', price: 1050, tier: 4, desc: 'Chrome engine, flame paint, pistons pumping.',
    build(k) {
      const d = baseCar(k, { color: '#1b1b24', L: 1.26, W: 0.6, cl: 0.4, cx: -0.22, ch: 0.2, r: 0.15, ww: 0.14, fx: 0.42, rx: 0.4, bumper: '#d8dbe4', wheel: { hub: '#e8303d', wall: '#f4f4f4' } });
      for (const s of [-1, 1]) {
        k.box(0.4, 0.06, 0.012, '#ff8a1f', 0.26, d.y0 + d.bh * 0.55, s * (d.W / 2 + 0.006));
        for (let i = 0; i < 3; i++) k.box(0.12, 0.035, 0.013, i % 2 ? '#ffd23f' : '#e8303d', 0.06 + i * 0.03, d.y0 + d.bh * (0.4 + i * 0.13), s * (d.W / 2 + 0.007), { rz: 0.4 });
      }
      k.box(0.34, 0.08, 0.3, '#d8dbe4', 0.22, d.top + 0.04, 0);
      const pistons = [];
      for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
        const p = k.box(0.05, 0.08, 0.06, '#f2f2f6', 0.12 + i * 0.1, d.top + 0.1, s * 0.07);
        pistons.push({ p, ph: i * 2.1 + (s > 0 ? PI : 0) });
      }
      for (const s of [-1, 1]) k.cyl(0.025, 0.025, 0.5, '#d8dbe4', 0.0, d.y0 + 0.02, s * (d.W / 2 + 0.03), { axis: 'x', seg: 8 });
      k.exhaust = [-0.26, d.y0 + 0.02, -(d.W / 2 + 0.03)];
      k.anims.push((c, dt) => {
        const f = 12 + c.speed * 2.2;
        pistons.forEach(o => { o.p.position.y = d.top + 0.1 + Math.max(0, Math.sin(c.t * f + o.ph)) * 0.035; });
      });
    } },
  { id: 'dune', name: 'Dune Hopper', price: 1100, tier: 4, desc: 'Roll cage, fat tyres, zero fear.',
    build(k) {
      k.L = 1.08;
      const c = '#ffb020';
      k.box(0.9, 0.12, 0.46, c, 0, 0.2, 0);
      k.box(0.3, 0.1, 0.42, c, 0.36, 0.28, 0, { rz: -0.25 });
      k.box(0.16, 0.14, 0.18, '#26262e', -0.1, 0.33, 0.1);
      k.box(0.16, 0.14, 0.18, '#26262e', -0.1, 0.33, -0.1);
      const bar = '#e8303d';
      for (const s of [-1, 1]) {
        k.box(0.035, 0.36, 0.035, bar, 0.16, 0.42, s * 0.2, { rz: -0.4 });
        k.box(0.035, 0.36, 0.035, bar, -0.3, 0.42, s * 0.2, { rz: 0.15 });
        k.box(0.5, 0.035, 0.035, bar, -0.08, 0.59, s * 0.2);
      }
      k.box(0.035, 0.035, 0.42, bar, 0.06, 0.59, 0); k.box(0.035, 0.035, 0.42, bar, -0.32, 0.59, 0);
      k.box(0.12, 0.08, 0.36, '#3d3d46', -0.44, 0.28, 0);
      const flag = k.group(-0.36, 0.6, 0.18);
      k.box(0.01, 0.4, 0.01, '#f2f2f6', 0, 0.2, 0, { parent: flag });
      const cloth = k.box(0.12, 0.07, 0.008, '#ff4f81', -0.06, 0.37, 0, { parent: flag });
      for (let i = 0; i < 2; i++) k.cyl(0.04, 0.04, 0.02, '#fff7c2', 0.04, 0.62, -0.08 + i * 0.16, { axis: 'x', seg: 8, e: '#ffe066', ei: 0.9 });
      k.tail(0.02, 0.04, 0.08, -0.5, 0.26, 0.14); k.tail(0.02, 0.04, 0.08, -0.5, 0.26, -0.14);
      k.pipe(-0.5, 0.18, 0);
      for (const s of [-1, 1]) { k.wheel(0.34, s * 0.27, 0.16, 0.14, true, { hub: c }); k.wheel(-0.32, s * 0.29, 0.2, 0.2, false, { hub: c }); }
      k.anims.push((c2, dt) => {
        flag.rotation.x = damp(flag.rotation.x, -c2.lean * 1.1, 6, dt);
        cloth.rotation.y = Math.sin(c2.t * 14) * 0.35 * Math.min(1, c2.speed / 5 + 0.2);
      });
    } },
  { id: 'lowrider', name: 'Bounce', price: 1150, tier: 4, desc: 'Lowrider on hydraulics. It hops to the beat.',
    build(k) {
      const d = baseCar(k, { color: '#7b2ff7', L: 1.4, W: 0.62, y0: 0.06, bh: 0.2, cl: 0.62, cx: -0.12, ch: 0.19, r: 0.13, roof: '#ffffff', bumper: '#ffd23f', trim: '#ffd23f', mirror: '#ffd23f', wheel: { hub: '#ffd23f', hub2: '#c99400', wall: '#ffffff' } });
      stripes(k, d, '#ffd23f', 0.0001, 0.02);
      k.box(d.L + 0.01, 0.02, d.W + 0.014, '#ff4fd8', 0, d.y0 + d.bh * 0.6, 0);
      k.anims.push((c, dt) => {
        const hop = Math.pow(Math.max(0, Math.sin(c.t * 4.2)), 6);
        k.lift = hop * 0.07;
        k.pitchExtra = hop * 0.12;
      });
    } },
  { id: 'stomper', name: 'Stomper', price: 1250, tier: 4, desc: 'Monster truck. Monster drifts.',
    build(k) {
      const d = baseCar(k, { color: '#7a3cff', L: 1.12, W: 0.6, r: 0.27, y0: 0.36, bh: 0.2, cl: 0.46, cx: -0.08, ch: 0.2, ww: 0.22, fx: 0.38, rx: 0.38, wheel: { hub: '#ffd23f' } });
      k.box(0.9, 0.06, 0.3, '#26262e', 0, 0.3, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.cyl(0.035, 0.035, 0.18, '#ffd23f', sx * 0.38, 0.38, sz * 0.18, { seg: 8 });
      k.box(d.L + 0.01, 0.04, d.W + 0.014, '#ffd23f', 0, d.y0 + d.bh * 0.45, 0);
      k.box(0.07, 0.04, d.cw * 0.9, '#26262e', d.cx + 0.1, d.top + d.ch + 0.02, 0);
      for (let i = 0; i < 4; i++) k.cyl(0.025, 0.025, 0.02, '#fff7c2', d.cx + 0.1, d.top + d.ch + 0.06, -0.15 + i * 0.1, { axis: 'x', seg: 8, e: '#ffe066', ei: 0.9 });
      k.springy = 2.2;
    } },
  { id: 'party', name: 'Party Bus', price: 1300, tier: 4, desc: 'Disco ball on the roof, lights that never sleep.',
    build(k) {
      const L = 1.72;
      const d = baseCar(k, { color: '#ff2e9a', L, W: 0.64, r: 0.15, y0: 0.1, bh: 0.26, cl: 1.5, cx: -0.1, ch: 0.34, cw: 0.62, roof: '#2a1040', glass: '#ff2e9a', fx: L * 0.36, rx: L * 0.33 });
      for (let i = 0; i < 7; i++) k.box(0.16, 0.15, d.cw + 0.016, GLASS, d.cx - 0.6 + i * 0.19, d.top + 0.17, 0);
      k.box(0.03, 0.16, d.cw * 0.86, GLASS, d.cx + d.cl / 2 + 0.002, d.top + 0.17, 0);
      const lamps = [];
      for (let i = 0; i < 6; i++) for (const s of [-1, 1]) {
        const m = new T.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1 });
        k.box(0.08, 0.04, 0.08, '', d.cx - 0.6 + i * 0.24, d.top + d.ch + 0.02, s * 0.22, { m });
        lamps.push({ m, ph: i * 0.17 + (s > 0 ? 0.5 : 0) });
      }
      const ballG = k.group(d.cx, d.top + d.ch + 0.17, 0);
      k.box(0.01, 0.1, 0.01, '#d8dbe4', 0, -0.07, 0, { parent: ballG });
      const ball = k.sphere(0.09, '#e6e9f2', 0, 0.03, 0, 1, 1, 1, { seg: 8, parent: ballG, m: new T.MeshPhongMaterial({ color: 0xe6e9f2, flatShading: true, shininess: 120, specular: 0xffffff, emissive: 0x333344 }) });
      k.anims.push((c, dt) => {
        ball.rotation.y += dt * 2.5;
        lamps.forEach(l => { l.m.color.setHSL((c.t * 0.35 + l.ph) % 1, 1, 0.55); l.m.emissive.copy(l.m.color); });
      });
    } },
  { id: 'synth', name: 'Synthwave', price: 1400, tier: 4, desc: 'Neon pink with a glowing underbelly.',
    build(k) {
      const d = baseCar(k, { color: '#ff2fb4', L: 1.2, W: 0.62, cl: 0.5, cx: -0.12, ch: 0.19, roof: '#2a1040', r: 0.14 });
      stripes(k, d, '#36f1ff', 0.1, 0.03);
      const glowM = new T.MeshBasicMaterial({ color: 0x36f1ff, transparent: true, opacity: 0.85 });
      k.box(d.L * 0.9, 0.02, d.W * 0.9, '', 0, 0.035, 0, { m: glowM });
      k.box(d.L + 0.012, 0.02, d.W + 0.016, '#36f1ff', 0, d.y0 + d.bh * 0.2, 0, { e: '#36f1ff', ei: 1.0 });
      spoiler(k, -d.L / 2 + 0.07, d.top, d.W * 0.85, '#2a1040');
      k.anims.push(c => { glowM.opacity = 0.55 + Math.sin(c.t * 4) * 0.3; });
    } },
  { id: 'robo', name: 'Robo Racer', price: 1450, tier: 4, desc: 'Scanning visor and a very springy antenna.',
    build(k) {
      k.L = 1.18;
      const c = '#c9ccd6', o = '#ff8a1f';
      k.box(1.12, 0.16, 0.62, c, 0, 0.17, 0);
      k.box(0.5, 0.2, 0.54, o, -0.1, 0.35, 0);
      k.box(0.3, 0.12, 0.58, c, 0.42, 0.28, 0, { rz: -0.35 });
      k.box(0.02, 0.07, 0.48, '#1d1d24', 0.155, 0.37, 0);
      const eyeM = new T.MeshBasicMaterial({ color: 0xff2a40 });
      const eye = k.box(0.025, 0.05, 0.1, '', 0.162, 0.37, 0, { m: eyeM });
      k.box(1.14, 0.04, 0.64, '#3d3d46', 0, 0.1, 0);
      for (const s of [-1, 1]) k.box(0.3, 0.1, 0.04, o, 0.2, 0.2, s * 0.32);
      const ant = k.group(-0.25, 0.45, 0.18);
      k.box(0.012, 0.3, 0.012, '#3d3d46', 0, 0.15, 0, { parent: ant });
      k.sphere(0.03, '#ff2a40', 0, 0.31, 0, 1, 1, 1, { parent: ant, e: '#ff2030', ei: 0.9 });
      k.lights(0.56, 0.2, 0.2);
      k.pipe(-0.6, 0.12, -0.2);
      k.wheels4(0.38, 0.38, 0.28, 0.14, 0.13, { hub: o, hub2: '#3d3d46' });
      let ax = 0, av = 0, az = 0, azv = 0;
      k.anims.push((cc, dt) => {
        eye.position.z = Math.sin(cc.t * 3) * 0.18;
        av += (-ax * 60 - av * 3 + cc.lean * 40) * dt; ax += av * dt;
        azv += (-az * 60 - azv * 3 - cc.accel * 4) * dt; az += azv * dt;
        ant.rotation.x = clamp(ax, -0.8, 0.8); ant.rotation.z = clamp(az + Math.min(0.3, cc.speed * 0.02), -0.8, 0.8);
      });
    } },
  { id: 'wedge', name: 'Vector', price: 1600, tier: 5, desc: 'Futuristic wedge from a city that doesn\'t exist yet.',
    build(k) {
      k.L = 1.22;
      const c = '#c9ccd6', y0 = 0.08;
      k.box(1.22, 0.14, 0.64, c, 0, y0 + 0.07, 0);
      k.box(1.0, 0.16, 0.6, c, -0.12, y0 + 0.17, 0, { rz: 0.1 });
      k.box(0.5, 0.12, 0.5, GLASS, -0.08, y0 + 0.28, 0, { rz: 0.12 });
      k.box(0.02, 0.03, 0.6, '#36f1ff', 0.612, y0 + 0.1, 0, { e: '#36f1ff', ei: 1 });
      k.tail(0.02, 0.03, 0.6, -0.612, y0 + 0.15, 0);
      k.box(1.2, 0.015, 0.012, '#36f1ff', 0, y0 + 0.08, 0.326, { e: '#36f1ff', ei: 1 });
      k.box(1.2, 0.015, 0.012, '#36f1ff', 0, y0 + 0.08, -0.326, { e: '#36f1ff', ei: 1 });
      k.box(1.1, 0.02, 0.56, '#9b5cff', 0, 0.035, 0, { e: '#9b5cff', ei: 1 });
      k.wheels4(0.4, 0.4, 0.29, 0.14, 0.12, { hub: '#36f1ff', hub2: '#1d1d24' });
    } },
  { id: 'rocket', name: 'Afterburner', price: 1800, tier: 5, desc: 'A dragster with a rocket strapped to the back.',
    build(k) {
      k.L = 1.5;
      const c = '#f4f6fb', r = '#e8303d';
      k.box(1.1, 0.1, 0.24, c, 0.12, 0.17, 0);
      k.box(0.4, 0.07, 0.14, c, 0.75, 0.14, 0);
      k.box(0.12, 0.02, 0.5, r, 0.88, 0.09, 0);
      k.box(1.1, 0.02, 0.25, r, 0.12, 0.225, 0);
      k.box(0.22, 0.14, 0.2, '#1d1d24', -0.12, 0.28, 0);
      k.sphere(0.075, r, -0.1, 0.39, 0, 1, 1, 1, { seg: 12 });
      k.cyl(0.11, 0.11, 0.42, '#d8dbe4', -0.42, 0.34, 0, { axis: 'x', seg: 12 });
      k.cyl(0.115, 0.08, 0.06, r, -0.65, 0.34, 0, { axis: 'x', seg: 12 });
      k.box(0.14, 0.02, 0.6, '#1d1d24', -0.5, 0.52, 0);
      k.box(0.04, 0.16, 0.04, '#1d1d24', -0.5, 0.43, 0.2); k.box(0.04, 0.16, 0.04, '#1d1d24', -0.5, 0.43, -0.2);
      const flame = k.group(-0.68, 0.34, 0);
      const fOuter = new T.MeshBasicMaterial({ color: 0xff7a00, transparent: true, opacity: 0.85 });
      const fInner = new T.MeshBasicMaterial({ color: 0xfff0a0 });
      k.cyl(0.08, 0.0, 0.3, '', -0.15, 0, 0, { axis: 'x', seg: 10, parent: flame, m: fOuter }).rotation.z = -HALF_PI;
      k.cyl(0.045, 0.0, 0.18, '', -0.09, 0, 0, { axis: 'x', seg: 8, parent: flame, m: fInner }).rotation.z = -HALF_PI;
      k.tail(0.02, 0.04, 0.12, -0.3, 0.16, 0);
      k.exhaust = null;
      for (const s of [-1, 1]) { k.wheel(0.62, s * 0.2, 0.09, 0.07, true, { hub: '#d8dbe4' }); k.wheel(-0.36, s * 0.32, 0.2, 0.2, false, { hub: r }); }
      k.anims.push((cc, dt) => {
        const sz = 0.5 + Math.min(1, cc.speed / 10) * 0.8 + Math.random() * 0.25;
        flame.scale.set(sz, 0.85 + Math.random() * 0.25, 0.85 + Math.random() * 0.25);
        fOuter.opacity = 0.6 + Math.random() * 0.3;
      });
    } },
  { id: 'hover', name: 'Hover X', price: 2000, tier: 5, desc: 'No wheels. No friction. All style.',
    build(k) {
      k.L = 1.2; k.hover = true;
      const c = '#f4f6fb', a = '#00d4ff';
      k.box(1.1, 0.12, 0.6, c, 0, 0.3, 0);
      k.box(0.4, 0.08, 0.5, c, 0.48, 0.28, 0, { rz: -0.15 });
      k.sphere(0.32, GLASS, -0.05, 0.36, 0, 1.2, 0.55, 0.75, { half: true, seg: 14 });
      k.box(1.12, 0.03, 0.62, a, 0, 0.25, 0, { e: a, ei: 0.8 });
      k.box(0.2, 0.06, 0.66, '#1d1d24', -0.5, 0.38, 0);
      k.box(0.02, 0.04, 0.4, '#fffbe6', 0.6, 0.3, 0, { e: '#fff1a8', ei: 1 });
      k.tail(0.02, 0.04, 0.5, -0.56, 0.31, 0);
      const pads = [];
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        k.cyl(0.11, 0.13, 0.06, '#3d3d46', sx * 0.36, 0.21, sz * 0.24, { seg: 12 });
        const m = new T.MeshBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.9 });
        const g = k.cyl(0.09, 0.09, 0.02, '', sx * 0.36, 0.175, sz * 0.24, { seg: 12, m });
        pads.push({ g, m });
      }
      k.anims.push((cc) => {
        pads.forEach((p, i) => { const s = 1 + Math.sin(cc.t * 9 + i) * 0.15; p.g.scale.set(s, 1, s); p.m.opacity = 0.6 + Math.sin(cc.t * 9 + i) * 0.3; });
      });
    } },
  { id: 'lava', name: 'Magma', price: 2200, tier: 5, desc: 'Cooled basalt shell with a molten heart.',
    build(k) {
      const d = baseCar(k, { color: '#2a2224', L: 1.22, W: 0.64, cl: 0.46, cx: -0.12, ch: 0.2, r: 0.15, ww: 0.15, roof: '#3a2f31', mirror: '#2a2224', wheel: { hub: '#ff6a00', hub2: '#2a2224' } });
      const glow = ownMat('#ff6a00', '#ff4a00', 1);
      const cracks = [[0.3, 0.2, 0.3, 0.5], [0.1, 0.1, 0.2, -0.6], [-0.25, 0.25, 0.25, 0.3], [-0.4, 0.12, 0.18, -0.4], [0.45, 0.08, 0.15, 0.9]];
      for (const s of [-1, 1]) cracks.forEach(([x, y, w, r]) => k.box(w, 0.018, 0.012, '', x, d.y0 + d.bh * (0.3 + y), s * (d.W / 2 + 0.006), { m: glow, rz: r }));
      cracks.slice(0, 3).forEach(([x, y, w, r]) => k.box(w, 0.012, 0.018, '', x * 0.8, d.top + 0.004, y - 0.15, { m: glow, ry: r }));
      spoiler(k, -d.L / 2 + 0.06, d.top, d.W * 0.85, '#2a2224', '#ff6a00');
      k.anims.push((cc) => { glow.emissiveIntensity = 0.7 + Math.sin(cc.t * 3) * 0.3 + Math.min(0.4, cc.slip * 1.5); });
    } },
  { id: 'aurum', name: 'Aurum', price: 2500, tier: 5, desc: 'Solid gold. Pure flex.',
    build(k) {
      const g = '#ffcc33';
      const d = baseCar(k, { color: g, L: 1.22, W: 0.64, cl: 0.46, cx: -0.12, ch: 0.2, r: 0.15, ww: 0.15, roof: '#ffd95e', bumper: '#fff1b0', trim: '#b8860b', wheel: { hub: '#fff1b0', hub2: '#b8860b' } });
      const gold = new T.MeshPhongMaterial({ color: g, flatShading: true, shininess: 110, specular: 0xfff0b0, emissive: 0x7a4a00, emissiveIntensity: 0.35 });
      k.body.traverse(o => { if (o.isMesh && o.material === mat(g)) o.material = gold; });
      stripes(k, d, '#fff6cf', 0.06, 0.05);
      spoiler(k, -d.L / 2 + 0.06, d.top, d.W * 0.85, '#ffd95e', '#b8860b');
    } },
  { id: 'ghost', name: 'Phantom', price: 2600, tier: 5, desc: 'Is it even there? The skid marks say yes.',
    build(k) {
      const shell = new T.MeshPhongMaterial({ color: 0x9ff6ff, emissive: 0x2bd9ff, emissiveIntensity: 0.5, transparent: true, opacity: 0.55, flatShading: true, shininess: 90, specular: 0xffffff, depthWrite: false });
      const d = baseCar(k, { color: '#9ff6ff', L: 1.18, W: 0.62, cl: 0.5, cx: -0.1, ch: 0.21, r: 0.14, wheel: { tire: '#1f5f7a', hub: '#9ff6ff' } });
      k.body.traverse(o => { if (o.isMesh && o.material === mat('#9ff6ff')) o.material = shell; });
      const core = k.box(0.3, 0.1, 0.3, '', 0, d.y0 + d.bh * 0.5, 0, { m: new T.MeshBasicMaterial({ color: 0xffffff }) });
      k.anims.push((cc) => {
        shell.opacity = 0.42 + Math.sin(cc.t * 2.2) * 0.14;
        core.scale.setScalar(0.3 + Math.sin(cc.t * 6) * 0.04); core.scale.y = 0.1;
      });
    } },
  { id: 'prism', name: 'Prism', price: 3000, tier: 5, desc: 'Every colour at once. The rarest ride on the road.',
    build(k) {
      const paint = new T.MeshPhongMaterial({ color: 0xff0000, flatShading: true, shininess: 100, specular: 0xffffff, emissive: 0x000000 });
      const d = baseCar(k, { color: '#fe01fe', L: 1.22, W: 0.64, cl: 0.46, cx: -0.12, ch: 0.2, r: 0.15, ww: 0.15, roof: '#ffffff', bumper: '#e6e9f2', trim: '#e6e9f2', wheel: { hub: '#ffffff', hub2: '#c9ccd6' } });
      k.body.traverse(o => { if (o.isMesh && o.material === mat('#fe01fe')) o.material = paint; });
      stripes(k, d, '#ffffff', 0.06, 0.04);
      spoiler(k, -d.L / 2 + 0.06, d.top, d.W * 0.85, '#ffffff', '#c9ccd6');
      const under = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
      k.box(d.L * 0.9, 0.02, d.W * 0.9, '', 0, 0.035, 0, { m: under });
      k.anims.push((cc) => {
        const h = (cc.t * 0.12) % 1;
        paint.color.setHSL(h, 0.9, 0.55); paint.emissive.setHSL(h, 1, 0.12);
        under.color.setHSL((h + 0.5) % 1, 1, 0.6);
      });
    } }
];
const TIERS = [
  { name: 'COMMON', color: '#d7e1ff' },
  { name: 'UNCOMMON', color: '#7dff8a' },
  { name: 'RARE', color: '#4fd2ff' },
  { name: 'EPIC', color: '#d38bff' },
  { name: 'LEGENDARY', color: '#ffbe3d' },
  { name: 'MYTHIC', color: '#ff5fa2' }
];
CARS.sort((a, b) => a.price - b.price);
const carById = id => CARS.find(c => c.id === id) || CARS[0];

function buildCarModel(id) {
  const def = carById(id);
  const g = new T.Group();
  const k = kit(g);
  def.build(k);
  return k;
}

/* Per-frame animation shared by every car: suspension bob, body lean and squat,
 * drift brake lights, light bars and each model's own moving parts.
 * c = { t, speed, slip, lean, accel } */
function animateCar(k, dt, c) {
  k.bob += dt * (5 + c.speed * 1.4);
  const springy = k.springy || 1;
  const amp = k.hover ? 0.03 : (0.0035 + c.speed * 0.0005 + c.slip * 0.01) * springy;
  const baseY = k.hover ? 0.07 + Math.sin(c.t * 2.4) * 0.025 : 0;
  k.body.position.y = baseY + Math.sin(k.bob) * amp + (k.lift || 0);
  k.body.rotation.x = damp(k.body.rotation.x, clamp(c.lean * 0.35 * springy, -0.12, 0.12), 9, dt);
  k.body.rotation.z = damp(k.body.rotation.z, clamp(-c.accel * 0.012 * springy, -0.08, 0.08) + (k.pitchExtra || 0), 7, dt);
  for (const m of k.tails) m.emissiveIntensity = 0.45 + clamp(c.slip * 3.5, 0, 1.6);
  for (const f of k.flash) {
    const on = Math.sin(c.t * 14 + f.phase * PI) > 0;
    f.m.material.color.copy(on ? f.a : f.b); f.m.material.emissive.copy(on ? f.a : f.b);
  }
  for (const a of k.anims) a(c, dt);
}

/* =========================================================================
 * Player car state
 * ========================================================================= */
const carRoot = new T.Group();
const carTilt = new T.Group();
carRoot.add(carTilt);
scene.add(carRoot);
let carKit = null;
function setPlayerCar(id) {
  if (carKit) carTilt.remove(carKit.g);
  carKit = buildCarModel(id);
  carTilt.add(carKit.g);
}

// blob shadow for low-quality mode
const blobTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 4, 32, 32, 30);
  gr.addColorStop(0, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new T.CanvasTexture(c);
})();
const blobShadow = new T.Mesh(new T.PlaneGeometry(1.5, 1.0), new T.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
blobShadow.rotation.x = -HALF_PI;
scene.add(blobShadow);

const car = {
  x: 0, y: 0, z: 0, psi: HALF_PI, phi: HALF_PI, speed: 0, slip: 0,
  segIdx: 0, dist: 0, vx: 0, vy: 0, vz: 0, lockAng: HALF_PI, wheelSpeed: 0, prevSpeed: 0, spawnT: 1,
  roll: 0, pitch: 0, tumbleX: 0, tumbleZ: 0, fallT: 0
};

const PHYS = { base: 6.3, add: 5.7, k: 1300, turnBase: 3.5, turnK: 0.21, grip: 7.0 };

/* =========================================================================
 * Effects: skid marks, smoke, sparkles
 * ========================================================================= */
const Skids = (() => {
  const MAX = 1400;
  const pos = new Float32Array(MAX * 4 * 3);
  const colr = new Float32Array(MAX * 4 * 4);
  const idx = new Uint32Array(MAX * 6);
  const born = new Float32Array(MAX).fill(-1e9);
  const str = new Float32Array(MAX);
  const cx = new Float32Array(MAX), cz = new Float32Array(MAX);
  for (let i = 0; i < MAX; i++) {
    const v = i * 4;
    idx.set([v, v + 1, v + 2, v, v + 2, v + 3], i * 6);
    for (let j = 0; j < 4; j++) colr.set([0.12, 0.1, 0.12, 0], (v + j) * 4);
  }
  const geo = new T.BufferGeometry();
  const pAttr = new T.BufferAttribute(pos, 3); pAttr.setUsage(T.DynamicDrawUsage);
  const cAttr = new T.BufferAttribute(colr, 4); cAttr.setUsage(T.DynamicDrawUsage);
  geo.setAttribute('position', pAttr); geo.setAttribute('color', cAttr);
  geo.setIndex(new T.BufferAttribute(idx, 1));
  // double-sided: depending on the drift direction a strip's winding can face down
  const m = new T.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new T.Mesh(geo, m);
  mesh.frustumCulled = false; mesh.renderOrder = 1;
  scene.add(mesh);
  let head = 0;
  const last = [null, null];
  function add(w, x, y, z, s, now) {
    const l = last[w];
    if (!l) { last[w] = { x, y, z }; return; }
    const dx = x - l.x, dz = z - l.z, d = Math.hypot(dx, dz);
    if (d < 0.1) return;
    if (d > 1.2) { last[w] = { x, y, z }; return; }
    const nx = -dz / d * 0.055, nz = dx / d * 0.055;
    const i = head; head = (head + 1) % MAX;
    const p = i * 12;
    pos[p] = l.x + nx; pos[p + 1] = l.y; pos[p + 2] = l.z + nz;
    pos[p + 3] = l.x - nx; pos[p + 4] = l.y; pos[p + 5] = l.z - nz;
    pos[p + 6] = x - nx; pos[p + 7] = y; pos[p + 8] = z - nz;
    pos[p + 9] = x + nx; pos[p + 10] = y; pos[p + 11] = z + nz;
    born[i] = now; str[i] = s; cx[i] = (x + l.x) / 2; cz[i] = (z + l.z) / 2;
    last[w] = { x, y, z };
    pAttr.needsUpdate = true;
  }
  function brk(w) { last[w] = null; }
  function update(now) {
    for (let i = 0; i < MAX; i++) {
      const age = now - born[i];
      const a = age > 12 ? 0 : (0.25 + str[i] * 0.55) * clamp(1 - (age - 9) / 3, 0, 1);
      const c = i * 16;
      colr[c + 3] = colr[c + 7] = colr[c + 11] = colr[c + 15] = a;
    }
    cAttr.needsUpdate = true;
  }
  function clearRect(seg) {
    for (let i = 0; i < MAX; i++) if (born[i] > -1e8) {
      const l = seg.local(cx[i], cz[i]);
      if (l[0] >= seg.s0 - 0.05 && l[0] <= seg.s1 + 0.05 && Math.abs(l[1]) <= ROAD_W / 2 + 0.05) born[i] = -1e9;
    }
  }
  function reset() { born.fill(-1e9); last[0] = last[1] = null; }
  return { add, brk, update, reset, clearRect, debug: () => { let n = 0, maxA = 0; for (let i = 0; i < MAX; i++) { const al = colr[i * 16 + 3]; if (al > 0) n++; maxA = Math.max(maxA, al); } return { n, maxA, head, sampleY: pos[1] }; } };
})();

const Particles = (() => {
  const smokeGeo = new T.IcosahedronGeometry(0.2, 0);
  const sparkGeo = new T.OctahedronGeometry(0.07, 0);
  const pool = [];
  function spawn(kind, x, y, z, vx, vy, vz, life, s0, s1, color) {
    let p = pool.find(q => !q.alive && q.kind === kind);
    if (!p) {
      if (pool.length > 220) return;
      const m = new T.Mesh(kind === 'smoke' ? smokeGeo : sparkGeo, new T.MeshLambertMaterial({ color: 0xffffff, transparent: true, flatShading: true, depthWrite: false, emissive: kind === 'spark' ? 0xffaa00 : 0x333333, emissiveIntensity: kind === 'spark' ? 0.8 : 0.35 }));
      scene.add(m);
      p = { m, kind };
      pool.push(p);
    }
    p.alive = true; p.t = 0; p.life = life; p.vx = vx; p.vy = vy; p.vz = vz; p.s0 = s0; p.s1 = s1;
    p.m.visible = true; p.m.position.set(x, y, z);
    p.m.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
    p.m.material.color.set(color || 0xffffff);
    p.m.material.opacity = kind === 'smoke' ? 0.75 : 1;
  }
  function update(dt) {
    for (const p of pool) {
      if (!p.alive) continue;
      p.t += dt;
      const k = p.t / p.life;
      if (k >= 1) { p.alive = false; p.m.visible = false; continue; }
      p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
      if (p.kind === 'smoke') { p.vx *= 0.96; p.vz *= 0.96; p.vy *= 0.97; p.m.material.opacity = 0.75 * (1 - k) * (1 - k); }
      else { p.vy -= 9 * dt; p.m.material.opacity = 1 - k; }
      const s = lerp(p.s0, p.s1, Math.sqrt(k));
      p.m.scale.setScalar(s);
      p.m.rotation.x += dt * 2; p.m.rotation.y += dt * 1.5;
    }
  }
  function clear() { pool.forEach(p => { p.alive = false; p.m.visible = false; }); }
  return { spawn, update, clear };
})();

/* =========================================================================
 * Game state
 * ========================================================================= */
let state = 'boot'; // boot | menu | ready | playing | falling | revive | gameover | paused
let menuSub = 'menu';
let pausedFrom = null;
let time = 0;
const input = { hold: false };
let steerLock = false;
let currentMode = 'endless', currentLevel = 1;
const runState = { fell: false, rawCoins: 0, score: 0, bonus: 0, coins: 0, perfects: 0, combo: 0, mult: 1, coinMult: 1, coinRush: false, insurance: false, insuranceUsed: false, headstart: false, revived: false, newBest: false, zone: 0, milestone: 500 };
let autopilot = false;
let autopilotForced = false; // test hook: never hand control back
let apHoldState = false;
let apNoise = 0, apErr = 0;

function resetCar(seg, s) {
  const lat = 0;
  car.x = seg.wx(s, lat); car.z = seg.wz(s, lat); car.y = seg.height(s);
  car.psi = car.phi = car.lockAng = seg.ang;
  car.segIdx = seg.index;
  car.speed = 0; car.slip = 0; car.vy = 0; car.roll = car.pitch = 0;
  car.tumbleX = car.tumbleZ = 0; car.fallT = 0;
  carTilt.rotation.set(0, 0, 0);
  apHoldState = seg.dir === 1;
  Skids.brk(0); Skids.brk(1);
}

function findSeg(x, z) {
  for (let i = car.segIdx - 1; i <= car.segIdx + 2; i++) {
    const s = segAt(i);
    if (s && s.contains(x, z)) return s;
  }
  return null;
}

/* Autopilot used by the menu attract mode and the Head Start booster.
 * Each step it forward-simulates "switch direction now" with the real car
 * dynamics and switches as soon as the line the car would settle onto
 * reaches the next segment's centre line. */
function settleOffset(targetAng, seg) {
  const grip = PHYS.grip * (1 + save.upgrades.traction * 0.09);
  const tr = PHYS.turnBase + car.speed * PHYS.turnK;
  const dt = 1 / 60, v = car.speed;
  let x = car.x, z = car.z, psi = car.psi, phi = car.phi;
  for (let i = 0; i < 90; i++) {
    psi += clamp(targetAng - psi, -tr * dt, tr * dt);
    phi += (psi - phi) * (1 - Math.exp(-grip * dt));
    x += Math.cos(phi) * v * dt; z -= Math.sin(phi) * v * dt;
    if (psi === targetAng && Math.abs(psi - phi) < 0.01) break;
  }
  const lag = v / grip;
  x += lag * (Math.cos(phi) - Math.cos(psi));
  z += lag * (-Math.sin(phi) + Math.sin(psi));
  // signed distance of the settle line past the corner, measured along the current direction
  return (x - seg.ex) * seg.ux + (z - seg.ez) * seg.uz;
}
function autopilotHold() {
  const curDir = apHoldState ? 1 : 0;
  let j = car.segIdx;
  let seg = segAt(j);
  if (seg && seg.dir !== curDir) seg = segAt(++j);
  if (!seg || !segAt(j + 1)) return apHoldState;
  const otherAng = DIRS[1 - curDir].ang;
  // apNoise models a human's timing error: switch up to apNoise seconds early or late
  if (settleOffset(otherAng, seg) >= -0.03 + apErr * car.speed) {
    apHoldState = !apHoldState;
    apErr = apNoise ? (Math.random() * 2 - 1) * apNoise : 0;
  }
  return apHoldState;
}

function physicsStep(dt, mode) {
  // mode: 'play' | 'attract'
  let target;
  if (mode === 'attract' || autopilot) target = autopilotHold() ? 0 : HALF_PI;
  else if (steerLock) target = car.lockAng;
  else target = input.hold ? 0 : HALF_PI;

  car.speed = damp(car.speed, speedAt(car.dist) * (mode === 'attract' ? 0.92 : 1), 2.2, dt);
  const tr = PHYS.turnBase + car.speed * PHYS.turnK;
  car.psi += clamp(target - car.psi, -tr * dt, tr * dt);
  const grip = PHYS.grip * (1 + save.upgrades.traction * 0.09);
  car.phi += (car.psi - car.phi) * (1 - Math.exp(-grip * dt));
  car.slip = Math.abs(car.psi - car.phi);
  car.vx = Math.cos(car.phi) * car.speed;
  car.vz = -Math.sin(car.phi) * car.speed;
  car.x += car.vx * dt; car.z += car.vz * dt;
  car.dist += car.speed * dt;

  const seg = findSeg(car.x, car.z);
  if (!seg) return false;
  car.segIdx = seg.index;
  const loc = seg.local(car.x, car.z);
  car.y = seg.height(loc[0]);

  if (mode === 'play') {
    // perfect-corner check halfway down each segment
    if (!seg.checked && seg.index > 0 && loc[0] > ROAD_W / 2 + Math.min(1.6, (seg.len - ROAD_W / 2) * 0.5)) {
      seg.checked = true;
      if (Math.abs(loc[1]) < 0.38 && Math.abs(car.psi - seg.ang) < 0.12) onPerfect();
      else runState.combo = 0;
    }
  }
  return true;
}

function onPerfect() {
  runState.combo++;
  runState.perfects++;
  const bonus = 2 + Math.min(runState.combo, 8);
  runState.bonus += bonus;
  const el = $('#combo');
  el.textContent = runState.combo > 1 ? `PERFECT x${runState.combo}  +${bonus * runState.mult}` : `PERFECT  +${bonus * runState.mult}`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  Sound.perfect(runState.combo);
  for (let i = 0; i < 8; i++) Particles.spawn('spark', car.x, car.y + 0.4, car.z, rand(-2, 2), rand(2, 4.5), rand(-2, 2), 0.7, 1.2, 0.4, i % 2 ? 0xffe066 : 0xffffff);
}

function wheelWorld(lx, lz) {
  const c = Math.cos(car.psi), s = Math.sin(car.psi);
  return [car.x + lx * c + lz * s, car.z - lx * s + lz * c];
}

let smokeAcc = 0;
function driveEffects(dt, onRoad) {
  const L = carKit ? carKit.L : 1.1;
  const intensity = clamp((car.slip - 0.05) * 3.2, 0, 1);
  const rear = -L * 0.32;
  for (let w = 0; w < 2; w++) {
    const [wx, wz] = wheelWorld(rear, w ? 0.25 : -0.25);
    if (onRoad && intensity > 0.02) Skids.add(w, wx, car.y + 0.012, wz, intensity, time);
    else Skids.brk(w);
  }
  if (onRoad && intensity > 0.25) {
    smokeAcc += dt * (save.settings.quality ? 34 : 16) * intensity;
    while (smokeAcc > 1) {
      smokeAcc--;
      const [wx, wz] = wheelWorld(rear - 0.05, Math.random() < 0.5 ? -0.25 : 0.25);
      Particles.spawn('smoke', wx + rand(-0.05, 0.05), car.y + 0.12, wz + rand(-0.05, 0.05), -car.vx * 0.08 + rand(-0.3, 0.3), rand(0.4, 0.9), -car.vz * 0.08 + rand(-0.3, 0.3), rand(0.6, 0.95), 0.5, rand(1.6, 2.4));
    }
  }
}

/* =========================================================================
 * Camera
 * ========================================================================= */
const cam = { pos: new T.Vector3(-6, 10, 6), look: new T.Vector3(), shake: 0, anchor: null, orbit: 0 };
const OFFSET = new T.Vector3(-6.3, 9.6, 6.3);
function updateCamera(dt, snap) {
  let tx = car.x, ty = car.y, tz = car.z;
  if (cam.anchor) { tx = cam.anchor.x; ty = cam.anchor.y; tz = cam.anchor.z; }
  const ahead = 1.4 + car.speed * 0.06;
  const lx = tx + ahead * 0.707, lz = tz - ahead * 0.707;
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  let k = 1 + Math.max(0, car.speed - 6.3) * 0.022;
  if (aspect < 1) k *= 1 + (1 - aspect) * 0.75;
  const off = OFFSET.clone().multiplyScalar(k);
  if (state === 'menu') {
    cam.orbit += dt;
    const a = Math.sin(cam.orbit * 0.13) * 0.42;
    off.applyAxisAngle(new T.Vector3(0, 1, 0), a);
    off.multiplyScalar(1.12);
    off.y *= 0.85;
  }
  const want = new T.Vector3(lx + off.x, ty * 0.5 + off.y, lz + off.z);
  if (snap) { cam.pos.copy(want); cam.look.set(lx, ty, lz); }
  else {
    cam.pos.x = damp(cam.pos.x, want.x, 5, dt); cam.pos.z = damp(cam.pos.z, want.z, 5, dt); cam.pos.y = damp(cam.pos.y, want.y, 3, dt);
    cam.look.x = damp(cam.look.x, lx, 7, dt); cam.look.z = damp(cam.look.z, lz, 7, dt); cam.look.y = damp(cam.look.y, ty * 0.6, 3.5, dt);
  }
  camera.position.copy(cam.pos);
  if (cam.shake > 0 && save.settings.shake) {
    camera.position.x += rand(-1, 1) * cam.shake; camera.position.y += rand(-1, 1) * cam.shake; camera.position.z += rand(-1, 1) * cam.shake;
  }
  cam.shake = Math.max(0, cam.shake - dt * 1.4);
  camera.lookAt(cam.look);
  sky.position.copy(camera.position);
  sun.position.set(cam.look.x + 7, cam.look.y + 16, cam.look.z + 5);
  sun.target.position.copy(cam.look);
}

/* =========================================================================
 * Main simulation
 * ========================================================================= */
const STEP = 1 / 120;
let acc = 0;

function fixedUpdate(dt) {
  if (state === 'menu') {
    const ok = physicsStep(dt, 'attract');
    driveEffects(dt, ok);
    if (!ok) { resetTrack(false, { mode: 'endless' }); resetCar(track.segs[0], -1.5); car.dist = 0; }
    maintainTrack();
    return;
  }
  if (state === 'playing') {
    const headDone = currentMode === 'level' ? pathPos() >= track.level.len * 0.3 : runState.score >= 300;
    if (autopilot && !autopilotForced && headDone) {
      // hand control back on a straight once the car is lined up
      const seg = segAt(car.segIdx);
      if (seg && Math.abs(car.psi - seg.ang) < 0.03 && seg.local(car.x, car.z)[0] < seg.len - 2.2) {
        autopilot = false; steerLock = true; car.lockAng = car.psi;
        toast('YOUR TURN!', 'head start complete'); Sound.go();
      }
    }
    const ok = physicsStep(dt, 'play');
    driveEffects(dt, ok);
    runState.score = Math.floor(car.dist * runState.mult) + runState.bonus * runState.mult;
    if (!ok) { startFall(); return; }
    maintainTrack();
    collectCoins(dt);
    const fin = track.finishSeg;
    if (fin && car.segIdx === fin.index && fin.local(car.x, car.z)[0] >= fin.finishS) levelComplete();
    return;
  }
  if (state === 'finished') {
    // coast to a stop on the finish straight with a little celebratory slide
    const seg = track.finishSeg;
    car.speed = damp(car.speed, 0, 1.4, dt);
    const tr = PHYS.turnBase + car.speed * PHYS.turnK;
    car.psi += clamp(seg.ang - car.psi, -tr * dt, tr * dt);
    car.phi += (car.psi - car.phi) * (1 - Math.exp(-PHYS.grip * 0.6 * dt));
    car.slip = Math.abs(car.psi - car.phi);
    car.vx = Math.cos(car.phi) * car.speed; car.vz = -Math.sin(car.phi) * car.speed;
    car.x += car.vx * dt; car.z += car.vz * dt;
    const l = seg.local(car.x, car.z), lim = ROAD_W / 2 - 0.35;
    if (Math.abs(l[1]) > lim) { const c = clamp(l[1], -lim, lim); car.x = seg.wx(l[0], c); car.z = seg.wz(l[0], c); }
    driveEffects(dt, true);
    return;
  }
  if (state === 'falling' || state === 'revive' || state === 'gameover') {
    car.fallT += dt;
    car.vx *= 0.995; car.vz *= 0.995;
    car.vy -= 24 * dt;
    car.x += car.vx * dt; car.z += car.vz * dt; car.y += car.vy * dt;
    // tip over the edge first, then tumble freely
    const tip = Math.min(1, 0.35 + car.fallT * 2.2);
    car.tumbleX += car.rollRate * tip * dt; car.tumbleZ += car.pitchRate * tip * dt;
    if (cam.anchor) cam.anchor.y = Math.max(car.y * 0.35, cam.anchor.y0 - 2.5);
    Skids.brk(0); Skids.brk(1);
    if (state === 'falling' && car.fallT > 1.05) afterFall();
  }
}

function maintainTrack() {
  while (!track.finishSeg && Math.hypot(lastSeg().ex - car.x, lastSeg().ez - car.z) < 95) genNext(car.dist);
  // drop old segments
  for (const seg of track.segs) {
    if (seg.state === 'idle' && seg.index < car.segIdx - 2) {
      const d = Math.hypot(seg.ex - car.x, seg.ez - car.z);
      if (d > 13) { seg.state = 'dropping'; seg.vy = 0; Skids.clearRect(seg); }
    }
  }
  while (track.segs.length && track.segs[0].state === 'gone') {
    disposeSeg(track.segs.shift()); track.base++;
  }
}

function animateTrack(dt) {
  for (const seg of track.segs) {
    if (seg.state === 'hidden') {
      const d = Math.hypot(seg.sx - car.x, seg.sz - car.z);
      if (d < 34) { seg.state = 'rising'; seg.anim = 0; seg.delay = 0; seg.group.visible = true; seg.group.position.y = -9; }
    } else if (seg.state === 'rising') {
      if (seg.delay > 0) { seg.delay -= dt; continue; }
      seg.anim = Math.min(1, seg.anim + dt / 0.6);
      seg.group.position.y = lerp(-9, 0, easeOutBack(seg.anim));
      if (seg.anim >= 1) { seg.state = 'idle'; seg.group.position.y = 0; }
    } else if (seg.state === 'dropping') {
      seg.vy -= 26 * dt;
      seg.group.position.y += seg.vy * dt;
      seg.group.rotation.x = 0;
      if (seg.group.position.y < -45) { seg.state = 'gone'; seg.group.visible = false; }
    }
    for (const c of seg.coins) {
      if (c.taken) continue;
      c.mesh.rotation.y = time * 3.2 + c.phase;
      c.mesh.position.y = c.y + Math.sin(time * 3 + c.phase) * 0.06;
    }
  }
}

function collectCoins(dt) {
  const r = 0.62 + save.upgrades.magnet * 0.35;
  const pull = save.upgrades.magnet > 0 ? r + 1.2 : 0;
  for (let i = car.segIdx - 1; i <= car.segIdx + 2; i++) {
    const seg = segAt(i);
    if (!seg || seg.state !== 'idle') continue;
    for (const c of seg.coins) {
      if (c.taken) continue;
      const dx = c.mesh.position.x - car.x, dz = c.mesh.position.z - car.z;
      const d = Math.hypot(dx, dz);
      if (pull && d < pull && d > 0.01) {
        const k = Math.min(1, dt * 9);
        c.mesh.position.x -= dx * k; c.mesh.position.z -= dz * k;
      }
      if (d < r) {
        c.taken = true;
        seg.group.remove(c.mesh);
        runState.coins += runState.coinMult;
        runState.rawCoins++;
        save.coins += runState.coinMult; save.totalCoins += runState.coinMult;
        Sound.coin();
        for (let j = 0; j < 6; j++) Particles.spawn('spark', c.mesh.position.x, c.y, c.mesh.position.z, rand(-1.5, 1.5), rand(1.5, 3.5), rand(-1.5, 1.5), 0.55, 1, 0.3, 0xffd23f);
        flyCoin(c.mesh.position.x, c.y, c.mesh.position.z);
        updateCoinsUI(true);
      }
    }
  }
}

function startFall() {
  state = 'falling';
  input.hold = false;
  const seg = segAt(car.segIdx);
  // tumble outward over the edge: roll towards whichever side of the car is past the edge
  let side = Math.random() < 0.5 ? 1 : -1;
  if (seg) {
    const l = seg.local(car.x, car.z)[1];
    const ox = seg.px * l, oz = seg.pz * l;
    side = Math.sign(ox * Math.sin(car.psi) + oz * Math.cos(car.psi)) || side;
  }
  car.rollRate = rand(3.0, 4.2) * side;
  car.pitchRate = rand(-2.6, -1.2);
  car.vy = 0.8;
  runState.fell = true;
  cam.anchor = { x: car.x, y: car.y, z: car.z, y0: car.y };
  cam.shake = 0.3;
  // crumbs of road and dust kicked up at the edge
  const th = seg ? THEMES[seg.theme] : THEMES[0];
  for (let i = 0; i < 10; i++) Particles.spawn('spark', car.x + rand(-0.3, 0.3), car.y + 0.05, car.z + rand(-0.3, 0.3), car.vx * 0.3 + rand(-1.5, 1.5), rand(1, 3), car.vz * 0.3 + rand(-1.5, 1.5), rand(0.6, 1), 1.6, 0.8, i % 2 ? th.a : th.side);
  for (let i = 0; i < 6; i++) Particles.spawn('smoke', car.x + rand(-0.3, 0.3), car.y + 0.1, car.z + rand(-0.3, 0.3), rand(-0.6, 0.6), rand(0.3, 0.8), rand(-0.6, 0.6), rand(0.7, 1.1), 0.6, 2.2);
  Sound.fall();
  Sound.engine(false, 0, 0);
}

function afterFall() {
  if (runState.insurance && !runState.insuranceUsed) {
    runState.insuranceUsed = true;
    renderHudBoosters();
    toast('INSURED!', 'second chance used');
    doRevive();
    return;
  }
  if (!runState.revived && save.coins >= reviveCost()) { openRevive(); return; }
  gameOver();
}
function reviveCost() { return currentMode === 'level' ? 50 + currentLevel * 5 : 100 + Math.floor(runState.score / 1000) * 50; }

function doRevive() {
  // place the car at the start of the next segment heading up-left
  let i = car.segIdx + 1;
  while (segAt(i) && segAt(i).dir !== 0) i++;
  let seg = segAt(i);
  if (!seg) seg = segAt(car.segIdx);
  // make sure segments around are up
  for (let j = i - 1; j <= i + 4; j++) { const s = segAt(j); if (s && s.state !== 'idle') { s.state = 'rising'; s.anim = 0; s.delay = 0; s.group.visible = true; } }
  if (track.finishSeg && seg.index >= track.finishSeg.index) seg = segAt(car.segIdx);
  resetCar(seg, ROAD_W / 2 + 0.3);
  car.spawnT = 0;
  car.dist = runState.score / runState.mult - runState.bonus; // keep progress
  car.speed = speedAt(car.dist) * 0.6;
  cam.anchor = null;
  Particles.clear();
  state = 'ready';
  $('#ready-title').textContent = 'TAP TO CONTINUE';
  $('#ready').classList.add('show');
  Sound.revive();
  showScreen(null);
}

/* =========================================================================
 * Run flow
 * ========================================================================= */
function startRun(mode, level) {
  Sound.ensure();
  if (mode) currentMode = mode;
  if (level) currentLevel = level;
  fadeTransition(() => {
    showScreen(null);
    Object.assign(runState, { fell: false, rawCoins: 0, score: 0, bonus: 0, coins: 0, perfects: 0, combo: 0, mult: 1, coinMult: 1, coinRush: false, insurance: false, insuranceUsed: false, headstart: false, revived: false, newBest: false, zone: 0, milestone: 500 });
    // consume boosters
    for (const b of BOOSTERS) {
      if (save.active[b.id] && save.boosters[b.id] > 0) {
        save.boosters[b.id]--;
        b.apply(runState);
      }
    }
    persist();
    const lvl = currentMode === 'level' ? levelParams(currentLevel) : null;
    resetTrack(true, lvl ? { mode: 'level', level: lvl } : { mode: 'endless' });
    Skids.reset(); Particles.clear();
    resetCar(track.segs[0], -1.5);
    car.spawnT = 0;
    car.dist = 0;
    cam.anchor = null; cam.orbit = 0;
    setSky(lvl ? lvl.sky : 0);
    updateCamera(0, true);
    state = 'ready';
    autopilot = false;
    $('#ready-title').textContent = runState.headstart ? 'TAP TO LAUNCH' : 'TAP TO START';
    $('#ready').classList.add('show');
    $('#hud').classList.add('show');
    $('#hud').classList.toggle('level-mode', !!lvl);
    if (lvl) {
      $('#hud-level-n').textContent = lvl.n;
      setTimeout(() => toast('LEVEL ' + lvl.n, THEMES[lvl.theme].name.toUpperCase()), 350);
    }
    renderHudBoosters();
    updateHud(true);
    updateCoinsUI();
  });
}

function beginDriving() {
  state = 'playing';
  $('#ready').classList.remove('show');
  steerLock = true; car.lockAng = car.psi;
  if (runState.headstart && car.dist < 1) { autopilot = true; toast('HEAD START!', 'sit back for a moment'); }
  if (!save.tutorial) { save.tutorial = true; persist(); }
  Sound.go();
}

function gameOver() {
  state = 'gameover';
  autopilot = false;
  save.runs++;
  const score = Math.floor(runState.score);
  const isBest = score > save.best;
  if (isBest) save.best = score;
  save.totalPerfects += runState.perfects;
  const lv = currentMode === 'level';
  let pct = 0;
  if (lv) {
    pct = Math.floor(clamp(pathPos() / (track.finishSeg ? track.finishSeg.pathStart + track.finishSeg.finishS : track.level.len), 0, 0.99) * 100);
    save.levelBest[currentLevel] = Math.max(save.levelBest[currentLevel] || 0, pct);
  }
  persist();
  $('#go-ribbon').classList.toggle('on', !lv && isBest && score > 0);
  $('#go-label').textContent = lv ? 'LEVEL ' + currentLevel + ' FAILED' : 'SCORE';
  $('#go-best-label').textContent = lv ? 'LEVEL BEST' : 'BEST';
  $('#go-best').textContent = lv ? save.levelBest[currentLevel] + '%' : fmt(save.best);
  $('#btn-go-garage').textContent = lv ? 'Levels' : 'Garage';
  $('#go-coins').textContent = fmt(runState.coins);
  $('#go-perfects').textContent = fmt(runState.perfects);
  showScreen('gameover');
  $('#hud').classList.remove('show');
  // count-up
  const el = $('#go-score');
  const target = lv ? pct : score;
  const t0 = performance.now(), dur = Math.min(1400, 400 + target * (lv ? 10 : 0.6));
  (function tick() {
    const k = Math.min(1, (performance.now() - t0) / dur);
    el.textContent = fmt(target * (1 - Math.pow(1 - k, 3))) + (lv ? '%' : '');
    if (k < 1) requestAnimationFrame(tick);
    else if (!lv && isBest && score > 0) { Sound.best(); confetti(); }
  })();
  updateCoinsUI();
}

function levelComplete() {
  state = 'finished';
  autopilot = false; input.hold = false;
  const n = currentLevel;
  const frac = track.coinTotal ? runState.rawCoins / track.coinTotal : 1;
  const stars = 1 + (frac >= 0.5 ? 1 : 0) + (frac >= 0.8 && !runState.fell ? 1 : 0);
  const reward = 10 + n * 2 + stars * 5;
  save.coins += reward; save.totalCoins += reward;
  save.levelStars[n] = Math.max(save.levelStars[n] || 0, stars);
  save.levelBest[n] = 100;
  save.level = Math.max(save.level, n + 1);
  save.runs++; save.totalPerfects += runState.perfects;
  persist();
  Sound.best();
  Sound.engine(false, 0, 0);
  toast('FINISH!', 'level ' + n + ' complete');
  // fireworks from the arch
  const seg = track.finishSeg;
  const fx = seg.wx(seg.finishS, 0), fz = seg.wz(seg.finishS, 0);
  const cols = [0xff2e9a, 0xffd400, 0x00d4ff, 0x7dff3a, 0xffffff, 0xb14bff];
  for (let i = 0; i < 60; i++) {
    const side = i % 2 ? 1 : -1;
    Particles.spawn('spark', seg.wx(seg.finishS, side * 1.7), 2.1, seg.wz(seg.finishS, side * 1.7), rand(-3, 3), rand(3, 7), rand(-3, 3), rand(0.9, 1.6), 1.6, 0.6, cols[i % cols.length]);
  }
  void fx; void fz;
  $('#hud').classList.remove('show');
  setTimeout(() => showComplete(n, stars, reward), 1400);
}
function showComplete(n, stars, reward) {
  $('#cp-title').textContent = 'LEVEL ' + n;
  $('#cp-coins').textContent = runState.rawCoins + ' / ' + track.coinTotal;
  $('#cp-perfects').textContent = fmt(runState.perfects);
  $('#cp-reward').textContent = '+' + reward;
  const st = $$('#cp-stars i');
  st.forEach(e => e.classList.remove('on'));
  showScreen('complete');
  st.forEach((e, i) => { if (i < stars) setTimeout(() => { e.classList.add('on'); Sound.perfect(i * 3); }, 450 + i * 380); });
  setTimeout(confetti, 300);
  updateCoinsUI();
}

function renderLevels() {
  const grid = $('#level-grid');
  grid.innerHTML = '';
  const count = Math.max(30, Math.ceil((save.level + 12) / 5) * 5);
  let total = 0;
  for (const k in save.levelStars) total += save.levelStars[k];
  for (let n = 1; n <= count; n++) {
    const b = document.createElement('button');
    const locked = n > save.level;
    const th = THEMES[(n - 1) % THEMES.length];
    const stars = save.levelStars[n] || 0;
    b.className = 'lvl ui' + (locked ? ' locked' : '') + (n === save.level ? ' current' : '') + (stars ? ' done' : '');
    b.style.setProperty('--a', th.a); b.style.setProperty('--b', th.side);
    b.innerHTML = `<span class="lvl-n">${n}</span><span class="lvl-stars">${[0, 1, 2].map(i => `<i class="${i < stars ? 'on' : ''}"></i>`).join('')}</span>`;
    b.onclick = () => { if (locked) { Sound.deny(); return; } Sound.click(); startRun('level', n); };
    grid.appendChild(b);
  }
  $('#levels-stars').textContent = total;
  $('#btn-level-continue').querySelector('span').textContent = 'Play Level ' + save.level;
  const cur = grid.querySelector('.current');
  if (cur) requestAnimationFrame(() => { grid.parentElement.scrollTop = cur.offsetTop - grid.parentElement.clientHeight / 2; });
}

let reviveTimer = null;
function openRevive() {
  state = 'revive';
  const cost = reviveCost();
  $('#revive-cost').textContent = cost;
  showScreen('revive');
  const ring = $('#revive-ring'), num = $('#revive-num');
  const t0 = performance.now(), dur = 5000;
  cancelAnimationFrame(reviveTimer);
  (function tick() {
    if (state !== 'revive') return;
    const k = Math.min(1, (performance.now() - t0) / dur);
    ring.style.strokeDashoffset = String(276.5 * k);
    num.textContent = String(Math.ceil(5 * (1 - k)) || 0);
    if (k >= 1) { gameOver(); return; }
    reviveTimer = requestAnimationFrame(tick);
  })();
}

function goMenu() {
  fadeTransition(() => {
    autopilot = false;
    $('#hud').classList.remove('show');
    $('#ready').classList.remove('show');
    enterAttract();
    showScreen('menu');
  });
}

function enterAttract() {
  state = 'menu';
  $('#hud').classList.remove('level-mode');
  resetTrack(true, { mode: 'endless' });
  Skids.reset(); Particles.clear();
  runState.coinRush = false;
  resetCar(track.segs[0], -1.5);
  car.dist = 0;
  cam.anchor = null;
  setSky((Math.random() * SKIES.length) | 0, true);
  updateCamera(0, true);
}

function togglePause(force) {
  if (state === 'paused' && force !== true) {
    state = pausedFrom; pausedFrom = null;
    showScreen(null);
    input.hold = false;
    if (state === 'playing') { steerLock = true; car.lockAng = car.psi; }
    last = performance.now();
    return;
  }
  if (state === 'playing' || state === 'ready') {
    pausedFrom = state; state = 'paused';
    input.hold = false;
    Sound.engine(false, 0, 0);
    showScreen('pause');
  }
}

/* =========================================================================
 * Sky / zones
 * ========================================================================= */
function setSky(i, snap) {
  skyState.target = i % SKIES.length;
  if (snap) {
    const s = SKIES[skyState.target];
    skyState.cur.top.set(s.top); skyState.cur.mid.set(s.mid); skyState.cur.bot.set(s.bot); skyState.cur.cloud.set(s.cloud);
  }
}
const tmpC = new T.Color();
function updateSky(dt) {
  const s = SKIES[skyState.target];
  const k = 1 - Math.exp(-dt * 1.2);
  skyState.cur.top.lerp(tmpC.set(s.top), k);
  skyState.cur.mid.lerp(tmpC.set(s.mid), k);
  skyState.cur.bot.lerp(tmpC.set(s.bot), k);
  skyState.cur.cloud.lerp(tmpC.set(s.cloud), k);
  skyUniforms.top.value.copy(skyState.cur.top);
  skyUniforms.mid.value.copy(skyState.cur.mid);
  skyUniforms.bot.value.copy(skyState.cur.bot);
  skyUniforms.time.value = time;
  scene.fog.color.copy(skyState.cur.bot).lerp(skyState.cur.mid, 0.25);
  cloudMat.color.copy(skyState.cur.cloud);
  hemi.groundColor.copy(skyState.cur.bot).multiplyScalar(0.9);
  document.body.style.background = '#' + skyState.cur.bot.getHexString();
}

/* =========================================================================
 * Per-frame visuals
 * ========================================================================= */
let hudScoreShown = -1;
function visualUpdate(dt) {
  animateTrack(dt);
  Particles.update(dt);
  Skids.update(time);
  updateSky(dt);

  // car transform
  carRoot.position.set(car.x, car.y, car.z);
  carRoot.rotation.y = car.psi;
  if (car.spawnT < 1) {
    // drop onto the road with a bounce
    const before = car.spawnT;
    car.spawnT = Math.min(1, car.spawnT + dt / 0.75);
    carRoot.position.y += (1 - easeOutBounce(car.spawnT)) * 2.4;
    if (before < 0.364 && car.spawnT >= 0.364) {
      cam.shake = Math.max(cam.shake, 0.06);
      for (let i = 0; i < 8; i++) Particles.spawn('smoke', car.x + rand(-0.5, 0.5), car.y + 0.08, car.z + rand(-0.5, 0.5), rand(-1.2, 1.2), rand(0.2, 0.6), rand(-1.2, 1.2), rand(0.5, 0.8), 0.5, 1.8);
    }
  }
  const falling = state === 'falling' || state === 'revive' || state === 'gameover';
  if (falling) {
    carTilt.rotation.x = car.tumbleX; carTilt.rotation.z = car.tumbleZ;
  } else {
    const seg = segAt(car.segIdx);
    let pitch = 0;
    if (seg) {
      const s = seg.local(car.x, car.z)[0];
      const dir = Math.cos(car.phi - seg.ang);
      pitch = Math.atan((seg.height(s + 0.35) - seg.height(s - 0.35)) / 0.7) * dir;
    }
    const rollTarget = clamp((car.psi - car.phi) * 0.45, -0.16, 0.16);
    car.roll = damp(car.roll, rollTarget, 10, dt);
    car.pitch = damp(car.pitch, pitch, 14, dt);
    carTilt.rotation.x = car.roll;
    carTilt.rotation.z = car.pitch;
  }
  if (carKit) {
    // counter-steer into the slide while drifting, steer into the turn otherwise
    const steer = clamp((car.phi - car.psi) * 1.6, -0.6, 0.6);
    carKit.steer.forEach(h => { h.rotation.y = damp(h.rotation.y, steer, 12, dt); });
    // wheels keep spinning (and slowly wind down) after leaving the road
    car.wheelSpeed = falling ? car.wheelSpeed * Math.exp(-dt * 1.2) : car.speed * (1 + clamp(car.slip, 0, 0.6));
    carKit.wheels.forEach(w => { w.spin.rotation.z -= car.wheelSpeed * dt / w.r; });
    const accel = dt > 0 ? (car.speed - (car.prevSpeed || 0)) / dt : 0;
    car.prevSpeed = car.speed;
    animateCar(carKit, dt, { t: time, speed: car.speed, slip: falling ? 0 : car.slip, lean: falling ? 0 : car.psi - car.phi, accel: clamp(accel, -20, 20) });
  }
  blobShadow.position.set(car.x, car.y + 0.02, car.z);
  blobShadow.rotation.z = car.psi;
  blobShadow.visible = !save.settings.quality && !falling;

  // engine audio
  const driving = state === 'playing';
  Sound.engine(driving, car.speed, clamp((car.slip - 0.04) * 3, 0, 1));

  // clouds
  for (const c of clouds) {
    c.position.x += c.userData.vx * dt;
    const dx = c.position.x - cam.look.x, dz = c.position.z - cam.look.z;
    if (Math.hypot(dx, dz) > 70 || (dx - dz) < -40) placeCloud(c, cam.look, true);
  }

  updateCamera(dt, false);

  if (state === 'playing' && currentMode === 'level' && track.level) {
    const end = track.finishSeg ? track.finishSeg.pathStart + track.finishSeg.finishS : track.level.len + 4;
    const k = clamp(pathPos() / end, 0, 1);
    $('#hud-level-fill').style.width = (k * 100).toFixed(1) + '%';
    $('#hud-level-car').style.left = (k * 100).toFixed(1) + '%';
  }
  if (state === 'playing') {
    updateHud(false);
    const zone = currentMode === 'endless' ? Math.floor(runState.score / 1000) : 0;
    if (zone > runState.zone) {
      runState.zone = zone;
      setSky(zone);
      toast(`ZONE ${zone + 1}`, SKIES[zone % SKIES.length].name.toUpperCase());
    } else if (currentMode === 'endless' && runState.score >= runState.milestone) {
      if (runState.milestone % 1000 !== 0) toast(fmt(runState.milestone), 'keep drifting!');
      runState.milestone += 500;
    }
    if (currentMode === 'endless' && !runState.newBest && save.best > 50 && runState.score > save.best) {
      runState.newBest = true;
      toast('NEW BEST!', 'you\'re on fire');
      Sound.best();
    }
  }
}

/* =========================================================================
 * HUD & UI helpers
 * ========================================================================= */
function updateHud(force) {
  const s = Math.floor(runState.score);
  if (s !== hudScoreShown || force) {
    const el = $('#hud-score');
    if (!force && Math.floor(s / 100) !== Math.floor(hudScoreShown / 100)) { el.classList.add('pop'); setTimeout(() => el.classList.remove('pop'), 150); }
    el.textContent = fmt(s);
    hudScoreShown = s;
    $('#hud-best').textContent = 'BEST ' + fmt(Math.max(save.best, s));
  }
}
function updateCoinsUI(bump) {
  $$('[data-coins]').forEach(e => { e.textContent = fmt(save.coins); });
  $$('[data-coins-run]').forEach(e => { e.textContent = fmt(runState.coins); });
  if (bump) { const p = $('#hud-coins'); p.classList.remove('bump'); void p.offsetWidth; p.classList.add('bump'); }
}
let toastTimer = 0;
function toast(big, small) {
  const el = $('#toast');
  el.innerHTML = '';
  el.appendChild(document.createTextNode(big));
  if (small) { const s = document.createElement('small'); s.textContent = small; el.appendChild(s); }
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 1900);
}
const projV = new T.Vector3();
function flyCoin(x, y, z) {
  const fx = $('#fx');
  if (fx.childElementCount > 14) return;
  projV.set(x, y, z).project(camera);
  const sx = (projV.x * 0.5 + 0.5) * window.innerWidth, sy = (-projV.y * 0.5 + 0.5) * window.innerHeight;
  const target = $('#hud-coins .coin').getBoundingClientRect();
  const el = document.createElement('i');
  el.className = 'coin fly-coin';
  el.style.transform = `translate(${sx - 11}px, ${sy - 11}px) scale(1.2)`;
  fx.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.transform = `translate(${target.left}px, ${target.top}px) scale(.8)`;
    el.style.opacity = '0.4';
  }));
  setTimeout(() => el.remove(), 650);
}
function confetti() {
  const fx = $('#fx');
  const colors = ['#ffd23f', '#ff4f81', '#3ee0b0', '#5fb8ff', '#ffffff', '#c58cff'];
  for (let i = 0; i < 70; i++) {
    const el = document.createElement('i');
    el.className = 'confetti';
    el.style.background = colors[i % colors.length];
    const x0 = window.innerWidth / 2, y0 = window.innerHeight * 0.35;
    const ang = rand(-PI, 0), sp = rand(300, 800);
    const vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp;
    fx.appendChild(el);
    const t0 = performance.now(), rot = rand(-720, 720);
    (function f() {
      const t = (performance.now() - t0) / 1000;
      if (t > 2.2) { el.remove(); return; }
      el.style.transform = `translate(${x0 + vx * t}px, ${y0 + vy * t + 700 * t * t}px) rotate(${rot * t}deg)`;
      el.style.opacity = String(1 - t / 2.2);
      requestAnimationFrame(f);
    })();
  }
}
function fadeTransition(fn) {
  const f = $('#fade');
  f.classList.add('on');
  Sound.whoosh();
  setTimeout(() => { fn(); requestAnimationFrame(() => f.classList.remove('on')); }, 300);
}

const SCREENS = ['menu', 'levels', 'garage', 'shop', 'spin', 'settings', 'help', 'pause', 'revive', 'gameover', 'complete'];
function showScreen(name) {
  SCREENS.forEach(s => $('#' + s).classList.toggle('show', s === name));
  if (['menu', 'levels', 'garage', 'shop', 'spin', 'settings', 'help'].includes(name)) menuSub = name;
  if (name === 'levels') renderLevels();
  if (name === 'garage') openGarage(); else garage.active = false;
  if (name === 'menu') refreshMenu();
  if (name === 'shop') renderShop();
  if (name === 'spin') renderSpin();
  if (name === 'settings') renderSettings();
}

/* =========================================================================
 * Boosters & upgrades
 * ========================================================================= */
const BOOSTERS = [
  { id: 'double', name: 'Double Score', short: '2x SCORE', price: 60, color: '#ff4f81', icon: '2x', desc: 'Every point counts twice for one run.', apply: r => { r.mult = 2; } },
  { id: 'insurance', name: 'Insurance', short: 'INSURED', price: 80, color: '#3ea0f0', icon: '+1', desc: 'Survive one fall for free.', apply: r => { r.insurance = true; } },
  { id: 'coinrush', name: 'Coin Rush', short: 'COIN RUSH', price: 50, color: '#f5a400', icon: '$', desc: 'More coins on the road, each worth double.', apply: r => { r.coinMult = 2; r.coinRush = true; } },
  { id: 'headstart', name: 'Head Start', short: 'HEAD START', price: 40, color: '#3cc44a', icon: '>>', desc: 'Autopilot drives the first 300 points.', apply: r => { r.headstart = true; } }
];
const UPGRADES = [
  { id: 'traction', name: 'Traction', color: '#9b5cff', icon: 'T', desc: 'Tyres grip harder: tighter, more controllable drifts.', costs: [120, 250, 450, 750, 1200] },
  { id: 'magnet', name: 'Coin Magnet', color: '#e8303d', icon: 'U', desc: 'Pull in nearby coins from further away.', costs: [100, 220, 400, 650, 1000] }
];

function renderHudBoosters() {
  const el = $('#hud-boosters');
  el.innerHTML = '';
  const list = [];
  if (runState.mult > 1) list.push(BOOSTERS[0]);
  if (runState.insurance) list.push(BOOSTERS[1]);
  if (runState.coinRush) list.push(BOOSTERS[2]);
  if (runState.headstart) list.push(BOOSTERS[3]);
  list.forEach(b => {
    const c = document.createElement('div');
    c.className = 'hud-chip' + (b.id === 'insurance' && runState.insuranceUsed ? ' used' : '');
    c.innerHTML = `<i style="background:${b.color}">${b.icon}</i>${b.short}`;
    el.appendChild(c);
  });
}

function renderMenuBoosters() {
  const el = $('#menu-boosters');
  el.innerHTML = '';
  BOOSTERS.forEach(b => {
    const n = save.boosters[b.id];
    if (!n) return;
    const c = document.createElement('button');
    c.className = 'b-chip ui' + (save.active[b.id] ? ' on' : '');
    c.innerHTML = `<i style="background:${b.color}">${b.icon}</i>${b.name}<em>x${n}</em>`;
    c.title = save.active[b.id] ? 'Will be used next run (tap to keep)' : 'Tap to use next run';
    c.onclick = () => { save.active[b.id] = !save.active[b.id]; persist(); Sound.click(); renderMenuBoosters(); };
    el.appendChild(c);
  });
}

let shopTab = 'boosters';
function renderShop() {
  $$('#shop .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === shopTab));
  const body = $('#shop-body');
  body.innerHTML = '';
  if (shopTab === 'boosters') {
    BOOSTERS.forEach(b => {
      const it = document.createElement('div');
      it.className = 'item';
      it.innerHTML = `<div class="item-ico" style="background:${b.color}">${b.icon}</div>
        <div class="item-body"><b>${b.name}</b><p>${b.desc}</p>
        <div class="item-meta"><span class="owned">Owned: ${save.boosters[b.id]}</span>
        <label class="use-toggle"><input type="checkbox" class="toggle sm" ${save.active[b.id] ? 'checked' : ''}> Use next run</label></div></div>
        <button class="btn green ui">${b.price} <i class="coin"></i></button>`;
      const btn = it.querySelector('button');
      if (save.coins < b.price) btn.classList.add('disabled');
      btn.onclick = () => {
        if (save.coins < b.price) { Sound.deny(); return; }
        save.coins -= b.price; save.boosters[b.id]++; save.active[b.id] = true; persist();
        Sound.buy(); updateCoinsUI(); renderShop();
      };
      it.querySelector('input').onchange = e => { save.active[b.id] = e.target.checked; persist(); Sound.click(); };
      body.appendChild(it);
    });
  } else {
    UPGRADES.forEach(u => {
      const lvl = save.upgrades[u.id];
      const max = lvl >= u.costs.length;
      const cost = max ? 0 : u.costs[lvl];
      const it = document.createElement('div');
      it.className = 'item';
      it.innerHTML = `<div class="item-ico" style="background:${u.color}">${u.icon}</div>
        <div class="item-body"><b>${u.name}</b><p>${u.desc}</p>
        <div class="item-meta"><div class="pips">${u.costs.map((_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div></div></div>
        <button class="btn green ui">${max ? 'MAX' : cost + ' <i class="coin"></i>'}</button>`;
      const btn = it.querySelector('button');
      if (max || save.coins < cost) btn.classList.add('disabled');
      btn.onclick = () => {
        if (max || save.coins < cost) { Sound.deny(); return; }
        save.coins -= cost; save.upgrades[u.id]++; persist();
        Sound.buy(); updateCoinsUI(); renderShop();
      };
      body.appendChild(it);
    });
  }
}

/* =========================================================================
 * Lucky spin
 * ========================================================================= */
const PRIZES = [
  { label: '25', coins: 25, w: 20, color: '#ff8a2b' },
  { label: '2x Score', booster: 'double', w: 12, color: '#ff4f81' },
  { label: '60', coins: 60, w: 14, color: '#9b5cff' },
  { label: 'Insurance', booster: 'insurance', w: 10, color: '#3ea0f0' },
  { label: '120', coins: 120, w: 8, color: '#3cc44a' },
  { label: 'Coin Rush', booster: 'coinrush', w: 12, color: '#f5a400' },
  { label: '400', coins: 400, w: 2, color: '#e8303d' },
  { label: 'Head Start', booster: 'headstart', w: 12, color: '#1fb3a8' }
];
const FREE_SPIN_MS = 4 * 3600 * 1000;
let wheelAngle = 0, spinning = false;
(function buildWheel() {
  const w = $('#wheel');
  const n = PRIZES.length, a = 360 / n;
  w.style.background = 'conic-gradient(' + PRIZES.map((p, i) => `${p.color} ${i * a}deg ${(i + 1) * a}deg`).join(',') + ')';
  PRIZES.forEach((p, i) => {
    const l = document.createElement('div');
    const c = i * a + a / 2;
    l.className = 'slice-label' + (c > 180 ? ' flip' : '');
    l.style.transform = `rotate(${c - 90}deg)`;
    l.innerHTML = `<span>${p.coins ? `${p.label} <i class="coin"></i>` : p.label}</span>`;
    w.appendChild(l);
  });
})();
function freeSpinReady() { return Date.now() - save.lastSpin >= FREE_SPIN_MS; }
function renderSpin() {
  const free = $('#spin-free'), paid = $('#spin-paid');
  const ready = freeSpinReady();
  free.classList.toggle('disabled', !ready || spinning);
  paid.classList.toggle('disabled', save.coins < 75 || spinning);
  if (!spinning) {
    if (ready) $('#spin-info').textContent = 'Your free spin is ready!';
    else {
      const ms = FREE_SPIN_MS - (Date.now() - save.lastSpin);
      const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
      $('#spin-info').textContent = `Next free spin in ${h}h ${m}m`;
    }
  }
  $('#spin-badge').classList.toggle('on', ready);
}
function doSpin(paid) {
  if (spinning) return;
  if (paid) { if (save.coins < 75) { Sound.deny(); return; } save.coins -= 75; }
  else { if (!freeSpinReady()) { Sound.deny(); return; } save.lastSpin = Date.now(); }
  persist(); updateCoinsUI();
  spinning = true;
  const total = PRIZES.reduce((s, p) => s + p.w, 0);
  let r = Math.random() * total, idx = 0;
  for (; idx < PRIZES.length; idx++) { r -= PRIZES[idx].w; if (r <= 0) break; }
  idx = Math.min(idx, PRIZES.length - 1);
  const a = 360 / PRIZES.length;
  const center = idx * a + a / 2 + rand(-a * 0.35, a * 0.35);
  const base = Math.ceil(wheelAngle / 360) * 360;
  wheelAngle = base + 360 * 6 + (360 - center);
  $('#wheel').style.transform = `rotate(${wheelAngle}deg)`;
  $('#spin-info').textContent = 'Spinning...';
  renderSpin();
  // ticking that slows down with the wheel
  let t = 0;
  for (let i = 0; i < 26; i++) { t += 40 + i * i * 0.9; setTimeout(() => Sound.tick(), t); }
  setTimeout(() => {
    spinning = false;
    const p = PRIZES[idx];
    if (p.coins) { save.coins += p.coins; $('#spin-info').textContent = `You won ${p.coins} coins!`; }
    else { save.boosters[p.booster]++; save.active[p.booster] = true; $('#spin-info').textContent = `You won ${p.label}!`; }
    persist(); updateCoinsUI(); Sound.buy();
    setTimeout(renderSpin, 1800);
    renderSpin();
    $('#spin-info').textContent = p.coins ? `You won ${p.coins} coins!` : `You won ${BOOSTERS.find(b => b.id === p.booster).name}!`;
  }, 4700);
}

/* =========================================================================
 * Settings
 * ========================================================================= */
function renderSettings() {
  $$('[data-setting]').forEach(el => { el.checked = !!save.settings[el.dataset.setting]; });
  $('#stats').innerHTML = `<div><small>BEST</small><b>${fmt(save.best)}</b></div><div><small>RUNS</small><b>${fmt(save.runs)}</b></div><div><small>CARS</small><b>${save.owned.length}/${CARS.length}</b></div>`;
}
$$('[data-setting]').forEach(el => {
  el.addEventListener('change', () => {
    save.settings[el.dataset.setting] = el.checked;
    persist();
    $$(`[data-setting="${el.dataset.setting}"]`).forEach(o => { o.checked = el.checked; });
    if (el.dataset.setting === 'quality') applyQuality();
    Sound.ensure(); Sound.apply(); Sound.click();
  });
});
let resetArmed = false;
$('#btn-reset').addEventListener('click', () => {
  if (!resetArmed) { resetArmed = true; $('#btn-reset').textContent = 'Tap again to confirm'; setTimeout(() => { resetArmed = false; $('#btn-reset').textContent = 'Reset progress'; }, 3000); return; }
  resetArmed = false;
  save = JSON.parse(JSON.stringify(DEFAULT_SAVE));
  persist();
  $('#btn-reset').textContent = 'Reset progress';
  setPlayerCar(save.car);
  Sound.apply(); applyQuality();
  updateCoinsUI(); renderSettings(); refreshMenu();
});

/* =========================================================================
 * Garage
 * ========================================================================= */
const garage = { scene: new T.Scene(), cam: new T.PerspectiveCamera(34, 1, 0.1, 100), holder: new T.Group(), idx: 0, model: null, active: false, rot: 0, pop: 1, thumbs: null };
(function buildGarage() {
  const g = garage.scene;
  const bg = document.createElement('canvas'); bg.width = 16; bg.height = 256;
  const ctx = bg.getContext('2d');
  const grd = ctx.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#2a0b78'); grd.addColorStop(0.45, '#9b1fd6'); grd.addColorStop(0.75, '#ff2e9a'); grd.addColorStop(1, '#ff9a2e');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, 16, 256);
  g.background = new T.CanvasTexture(bg);
  g.add(new T.HemisphereLight(0xffffff, 0x8a4a6a, 0.62));
  const d = new T.DirectionalLight(0xffffff, 0.6); d.position.set(3, 6, 4); d.castShadow = true;
  d.shadow.mapSize.set(1024, 1024);
  Object.assign(d.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3 });
  g.add(d);
  const rim = new T.DirectionalLight(0xffb0d0, 0.35); rim.position.set(-4, 3, -4); g.add(rim);
  const pod = new T.Mesh(new T.CylinderGeometry(1.45, 1.6, 0.22, 48), new T.MeshLambertMaterial({ color: 0x3a2350 }));
  pod.position.y = -0.11; pod.receiveShadow = true; g.add(pod);
  const top = new T.Mesh(new T.CylinderGeometry(1.38, 1.38, 0.02, 48), new T.MeshLambertMaterial({ color: 0x51306e }));
  top.position.y = 0.0; top.receiveShadow = true; g.add(top);
  const ring = new T.Mesh(new T.TorusGeometry(1.5, 0.03, 8, 64), new T.MeshBasicMaterial({ color: 0xffd23f }));
  ring.rotation.x = HALF_PI; ring.position.y = -0.02; g.add(ring);
  garage.ring = ring;
  // light beams sweeping behind the podium
  garage.beams = [];
  for (let i = 0; i < 5; i++) {
    const b = new T.Mesh(new T.PlaneGeometry(0.5, 9), new T.MeshBasicMaterial({ color: [0x00d4ff, 0xff2e9a, 0xffd400, 0x7dff3a, 0xb14bff][i], transparent: true, opacity: 0.16, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending }));
    b.position.set(-3 + i * 1.5, 3, -3.5); b.rotation.y = 0.78;
    g.add(b); garage.beams.push(b);
  }
  g.add(garage.holder);
})();

function openGarage() {
  garage.active = true;
  garage.idx = Math.max(0, CARS.findIndex(c => c.id === save.car));
  buildThumbs();
  showGarageCar(true);
}
function showGarageCar(instant) {
  const def = CARS[garage.idx];
  if (garage.model) garage.holder.remove(garage.model.g);
  garage.model = buildCarModel(def.id);
  const L = garage.model.L;
  const s = 1.55 / Math.max(1.05, L * 0.95);
  garage.model.g.scale.setScalar(s);
  garage.holder.add(garage.model.g);
  garage.pop = instant ? 1 : 0;
  const owned = save.owned.includes(def.id);
  const tier = TIERS[def.tier];
  $('#g-tier').textContent = tier.name; $('#g-tier').style.color = tier.color;
  $('#g-name').textContent = def.name;
  $('#g-desc').textContent = def.desc;
  const btn = $('#g-action');
  btn.className = 'btn ui';
  if (save.car === def.id) { btn.innerHTML = 'Equipped'; btn.classList.add('ghost'); }
  else if (owned) { btn.innerHTML = 'Select'; btn.classList.add('green'); }
  else { btn.innerHTML = `${def.price} <i class="coin"></i>`; if (save.coins < def.price) btn.classList.add('disabled'); }
  $('#g-count').textContent = `${save.owned.length} / ${CARS.length} cars unlocked`;
  $$('#g-thumbs .thumb').forEach((t, i) => {
    t.classList.toggle('active', i === garage.idx);
    t.classList.toggle('locked', !save.owned.includes(CARS[i].id));
    const eq = t.querySelector('.eq'); if (eq) eq.style.display = CARS[i].id === save.car ? 'block' : 'none';
  });
  const act = $$('#g-thumbs .thumb')[garage.idx];
  if (act) { const p = $('#g-thumbs'); p.scrollLeft = act.offsetLeft - p.clientWidth / 2 + act.clientWidth / 2; }
}
function buildThumbs() {
  const wrap = $('#g-thumbs');
  if (!garage.thumbs) {
    garage.thumbs = [];
    let r;
    try {
      r = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      r.setSize(168, 132); r.setPixelRatio(1);
      const sc2 = new T.Scene();
      sc2.add(new T.HemisphereLight(0xffffff, 0x8a4a6a, 0.7));
      const dl = new T.DirectionalLight(0xffffff, 0.55); dl.position.set(3, 6, 4); sc2.add(dl);
      const cm = new T.PerspectiveCamera(30, 168 / 132, 0.1, 50);
      for (const def of CARS) {
        const k = buildCarModel(def.id);
        const s = 1.2 / Math.max(1.05, k.L * 0.95);
        k.g.scale.setScalar(s);
        k.g.rotation.y = 0.7;
        sc2.add(k.g);
        cm.position.set(2.1, 1.45, 2.1); cm.lookAt(0, 0.22, 0);
        r.render(sc2, cm);
        garage.thumbs.push(r.domElement.toDataURL());
        sc2.remove(k.g);
      }
    } catch (e) { /* thumbnails are optional */ }
    if (r) { r.dispose(); if (r.forceContextLoss) r.forceContextLoss(); }
  }
  if (wrap.childElementCount !== CARS.length) {
    wrap.innerHTML = '';
    CARS.forEach((def, i) => {
      const b = document.createElement('button');
      b.className = 'thumb ui';
      b.title = def.name;
      b.innerHTML = (garage.thumbs[i] ? `<img alt="${def.name}" src="${garage.thumbs[i]}">` : `<span>${def.name}</span>`) + '<span class="eq"></span>';
      b.onclick = () => { garage.idx = i; Sound.click(); showGarageCar(false); };
      wrap.appendChild(b);
    });
  }
}
function garageAction() {
  const def = CARS[garage.idx];
  if (save.car === def.id) return;
  if (save.owned.includes(def.id)) {
    save.car = def.id; persist(); setPlayerCar(def.id); Sound.click();
  } else {
    if (save.coins < def.price) { Sound.deny(); return; }
    save.coins -= def.price; save.owned.push(def.id); save.car = def.id; persist();
    setPlayerCar(def.id); Sound.buy(); updateCoinsUI(); confetti();
  }
  showGarageCar(true);
}
function updateGarage(dt) {
  garage.rot += dt * 0.5;
  if (garage.ring) garage.ring.material.color.setHSL((time * 0.08) % 1, 1, 0.6);
  if (garage.beams) garage.beams.forEach((b, i) => { b.rotation.z = Math.sin(time * 0.6 + i * 1.3) * 0.45; });
  garage.holder.rotation.y = garage.rot;
  garage.pop = Math.min(1, garage.pop + dt * 2.6);
  const p = easeOutBack(garage.pop);
  garage.holder.scale.setScalar(0.4 + 0.6 * p);
  garage.holder.position.y = (1 - p) * 0.8;
  if (garage.model) {
    garage.model.wheels.forEach(w => { w.spin.rotation.z -= dt * 2.5; });
    // a gentle showroom 'drift' so every car's animations are visible
    const lean = Math.sin(time * 0.9) * 0.25;
    animateCar(garage.model, dt, { t: time, speed: 4, slip: Math.abs(lean) * 0.5, lean, accel: Math.cos(time * 0.9) * 2 });
  }
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  const dist = aspect < 1 ? 6.4 + (1 - aspect) * 4 : 5.6;
  garage.cam.position.set(dist * 0.72, dist * 0.42, dist * 0.72);
  garage.cam.lookAt(0, aspect < 1 ? -0.1 : -0.35, 0);
}

/* =========================================================================
 * Menu
 * ========================================================================= */
function refreshMenu() {
  const def = carById(save.car);
  $('#menu-car-name').textContent = def.name;
  $('#menu-car-tier').textContent = TIERS[def.tier].name;
  $('#menu-car-tier').style.color = TIERS[def.tier].color;
  $('#menu-best').textContent = fmt(save.best);
  $('#mc-endless-best').textContent = 'Best ' + fmt(save.best);
  let stars = 0; for (const k in save.levelStars) stars += save.levelStars[k];
  $('#mc-level-sub').textContent = 'Level ' + save.level + ' \u00b7 ' + stars + ' \u2605';
  renderMenuBoosters();
  updateCoinsUI();
  $('#spin-badge').classList.toggle('on', freeSpinReady());
}
function cycleOwned(dir) {
  const owned = CARS.filter(c => save.owned.includes(c.id));
  let i = owned.findIndex(c => c.id === save.car);
  i = (i + dir + owned.length) % owned.length;
  save.car = owned[i].id; persist();
  setPlayerCar(save.car);
  Sound.click();
  refreshMenu();
  if (owned.length === 1) toast('UNLOCK MORE', 'in the garage');
}

/* =========================================================================
 * Input
 * ========================================================================= */
function isUI(el) { return !!(el && el.closest && el.closest('.ui, .panel, .sheet, button, input, label, a')); }
function press() {
  Sound.ensure();
  if (input.hold) return;
  input.hold = true;
  if (state === 'ready') { beginDriving(); return; }
  if (state === 'playing' && steerLock) steerLock = false;
}
function release() {
  if (!input.hold) return;
  input.hold = false;
  if (state === 'playing' && steerLock) steerLock = false;
}
window.addEventListener('pointerdown', e => {
  if (isUI(e.target)) { Sound.ensure(); return; }
  if (state === 'ready' || state === 'playing') { e.preventDefault(); press(); }
}, { passive: false });
window.addEventListener('pointerup', release);
window.addEventListener('pointercancel', release);
window.addEventListener('blur', () => { release(); if (state === 'playing') togglePause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') togglePause(); });
const DRIVE_KEYS = ['Space', 'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'KeyD', 'KeyA', 'KeyW', 'KeyS', 'ShiftLeft', 'ShiftRight'];
window.addEventListener('keydown', e => {
  if (e.code === 'Escape' || e.code === 'KeyP') { if (state === 'playing' || state === 'ready' || state === 'paused') { togglePause(); e.preventDefault(); } return; }
  if (e.code === 'Enter') {
    if (state === 'menu' && menuSub === 'menu') { startRun('endless'); e.preventDefault(); }
    else if (state === 'gameover') { startRun(); e.preventDefault(); }
    else if (state === 'finished' && $('#complete').classList.contains('show')) { startRun('level', currentLevel + 1); e.preventDefault(); }
    return;
  }
  if (DRIVE_KEYS.includes(e.code)) {
    e.preventDefault();
    if (e.repeat) return;
    if (state === 'gameover' && e.code === 'Space') { startRun(); return; }
    press();
  }
});
window.addEventListener('keyup', e => { if (DRIVE_KEYS.includes(e.code)) release(); });
window.addEventListener('contextmenu', e => e.preventDefault());

// buttons
const on = (sel, fn) => $(sel).addEventListener('click', e => { e.stopPropagation(); fn(e); });
on('#btn-endless', () => { Sound.click(); startRun('endless'); });
on('#btn-levels', () => { Sound.ensure(); Sound.click(); showScreen('levels'); });
on('#btn-level-continue', () => { Sound.click(); startRun('level', save.level); });
on('#btn-cp-next', () => { Sound.click(); startRun('level', currentLevel + 1); });
on('#btn-cp-replay', () => { Sound.click(); startRun('level', currentLevel); });
on('#btn-cp-menu', () => { Sound.click(); goMenu(); });
$$('[data-open]').forEach(b => b.addEventListener('click', () => { Sound.ensure(); Sound.click(); showScreen(b.dataset.open); }));
$$('[data-back]').forEach(b => b.addEventListener('click', () => {
  Sound.click();
  if (state === 'menu') showScreen('menu');
  else if (state === 'gameover') showScreen('gameover');
}));
on('#menu-prev', () => cycleOwned(-1));
on('#menu-next', () => cycleOwned(1));
on('#g-prev', () => { garage.idx = (garage.idx - 1 + CARS.length) % CARS.length; Sound.click(); showGarageCar(false); });
on('#g-next', () => { garage.idx = (garage.idx + 1) % CARS.length; Sound.click(); showGarageCar(false); });
on('#g-action', garageAction);
$$('#shop .tab').forEach(t => t.addEventListener('click', () => { shopTab = t.dataset.tab; Sound.click(); renderShop(); }));
on('#spin-free', () => doSpin(false));
on('#spin-paid', () => doSpin(true));
on('#btn-pause', () => { Sound.click(); togglePause(); });
on('#btn-resume', () => { Sound.click(); togglePause(); });
on('#btn-restart', () => { Sound.click(); startRun(); });
on('#btn-pause-menu', () => { Sound.click(); goMenu(); });
on('#btn-retry', () => { Sound.click(); startRun(); });
on('#btn-go-menu', () => { Sound.click(); goMenu(); });
on('#btn-go-garage', () => {
  Sound.click();
  const target = currentMode === 'level' ? 'levels' : 'garage';
  fadeTransition(() => { $('#hud').classList.remove('show'); enterAttract(); showScreen(target); });
});
on('#btn-revive', () => {
  const cost = reviveCost();
  if (save.coins < cost) { Sound.deny(); return; }
  save.coins -= cost; persist(); updateCoinsUI();
  runState.revived = true;
  cancelAnimationFrame(reviveTimer);
  doRevive();
});
on('#btn-skip-revive', () => { cancelAnimationFrame(reviveTimer); Sound.click(); gameOver(); });
// stop UI clicks from steering
$$('.ui').forEach(el => el.addEventListener('pointerdown', e => e.stopPropagation()));

/* =========================================================================
 * Resize & loop
 * ========================================================================= */
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < 1 ? 46 : 40;
  camera.updateProjectionMatrix();
  garage.cam.aspect = w / h;
  garage.cam.fov = w / h < 1 ? 44 : 34;
  garage.cam.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  time += dt;
  if (garage.active) {
    updateGarage(dt);
    renderer.render(garage.scene, garage.cam);
    return;
  }
  if (state !== 'paused') {
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 12) { fixedUpdate(STEP); acc -= STEP; n++; }
    if (n >= 12) acc = 0;
    visualUpdate(dt);
  }
  renderer.render(scene, camera);
}

/* =========================================================================
 * Boot
 * ========================================================================= */
function boot() {
  setPlayerCar(save.car);
  applyQuality();
  clouds.forEach(c => placeCloud(c, new T.Vector3(0, 0, 0), false));
  enterAttract();
  refreshMenu();
  requestAnimationFrame(frame);
  setTimeout(() => {
    state = 'menu';
    showScreen('menu');
    $('#boot').classList.add('done');
  }, 250);
  setInterval(() => { if (state === 'menu') $('#spin-badge').classList.toggle('on', freeSpinReady()); if (menuSub === 'spin' && !spinning && $('#spin').classList.contains('show')) renderSpin(); }, 30000);
}

// Debug / test hook
window.__driftMaster = {
  get state() { return state; },
  get score() { return runState.score; },
  get car() { return car; },
  start: startRun,
  setAutopilot(v) { autopilot = v; },
  setNoise(v) { apNoise = v; apErr = 0; },
  get level() { return { n: currentLevel, finished: state === 'finished', coins: runState.rawCoins, total: track.coinTotal, stars: save.levelStars[currentLevel] || 0, unlocked: save.level }; },
  skids() { return Skids.debug(); },
  segLens() { return track.segs.map(sg => +sg.len.toFixed(2)); },
  simulate(seconds) {
    // fast-forward the simulation with the autopilot at the wheel (used for balancing tests)
    autopilot = true; autopilotForced = true;
    if (state === 'ready') beginDriving();
    autopilot = true;
    const steps = Math.floor(seconds / STEP);
    for (let i = 0; i < steps && state === 'playing'; i++) { fixedUpdate(STEP); if (i % 12 === 0) animateTrack(STEP * 12); }
    const info = { state, score: runState.score, dist: car.dist, speed: car.speed };
    if (state !== 'playing') {
      const segs = [];
      for (let i = car.segIdx - 2; i <= car.segIdx + 2; i++) { const sg = segAt(i); if (sg) segs.push({ i, dir: sg.dir, len: +sg.len.toFixed(2), wave: !!sg.wave, loc: sg.local(car.x, car.z).map(v => +v.toFixed(2)) }); }
      Object.assign(info, { segIdx: car.segIdx, psi: +car.psi.toFixed(3), phi: +car.phi.toFixed(3), segs });
    }
    return info;
  }
};

boot();
})();
