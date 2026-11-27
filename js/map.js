// js/map.js — THE SHINOBI CONTINENT
// A living, Naruto-themed canvas map.
//
//  • procedural coastline + painted biomes (Fire forest, Stone Peaks, Cloud highlands,
//    Wind desert, Mist marsh, Valley of the End)
//  • Hokage Rock, Valley of the End statues + waterfall, walled villages, rivers
//  • hitai-ate (ninja headband) pins with engraved village symbols
//  • drifting leaves, fireflies, sand streaks, fog, lightning, crows, ships, whirlpool
//  • chakra routes with travelling comets, smoke "poof" jutsu on click / arrival
//  • drag-to-pan, wheel / pinch zoom, fly-to navigation, cinematic intro
//
// Public API (unchanged):  window.ShinobiMap.focusLocation(id, cb) / .resetView()
// Calls:                   window.openLocationScroll(id)
(() => {
  'use strict';

  const canvas = document.getElementById('worldMapCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  /* ════════════════════════════════════════════════════════════════════════
0. CONFIG
  ════════════════════════════════════════════════════════════════════════ */
  const CFG = {
    clickDelay: 240,   // ms between the "poof" and openLocationScroll()
    focusZoom: 1.9,    // zoom used when flying to a location
    minZoom: 0.85,
    maxZoom: 2.6,
    intro: true        // cinematic first-load sequence
  };
  const REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const FONT_UI = '"Space Grotesk", "Segoe UI", system-ui, sans-serif';
  const FONT_MONO = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';
  const FONT_JP = '"Yuji Syuku", "Noto Serif JP", "Yu Mincho", "Hiragino Mincho ProN", "Noto Serif CJK JP", "Noto Sans JP", "Yu Gothic", "Meiryo", serif';
  const TITLE = 'The Shinobi Continent';

  /* ════════════════════════════════════════════════════════════════════════
1. HELPERS
  ════════════════════════════════════════════════════════════════════════ */
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeOutBack = (t) => { const c1 = 1.9, c3 = c1 + 1, u = t - 1; return 1 + c3 * u * u * u + c1 * u * u; };

  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  const rgba = (hex, a) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };

  function roundRectPath(c, x, y, w, h, r) {
    c.beginPath();
    if (w <= 0.5 || h <= 0.5) return;   // tiny during pop-in animation
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  // quadratic mid-point smoothing — works on a context or a Path2D
  function smoothClosed(c, pts) {
    const n = pts.length;
    c.moveTo((pts[n - 1].x + pts[0].x) / 2, (pts[n - 1].y + pts[0].y) / 2);
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      c.quadraticCurveTo(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2);
    }
    c.closePath();
  }
  function smoothOpen(c, pts) {
    c.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i], q = pts[i + 1];
      c.quadraticCurveTo(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2);
    }
    const l = pts[pts.length - 1];
    c.lineTo(l.x, l.y);
  }
  function distToPolyline(x, y, pts) {
    let best = 1e9;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const t = clamp(((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy), 0, 1);
      best = Math.min(best, Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t)));
    }
    return best;
  }
  function xAtY(pts, y) {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (y >= a.y && y <= b.y) return lerp(a.x, b.x, (y - a.y) / (b.y - a.y));
    }
    return pts[pts.length - 1].x;
  }

  /* ════════════════════════════════════════════════════════════════════════
2. WORLD DATA   (world units: 1 map-unit of the old code = 1000)
  ════════════════════════════════════════════════════════════════════════ */
  const W = 1000;
  const locations = [
    { id: 'about',     label: 'Leaf Outpost',  guide: 'About & Dossier',      tag: 'HIDDEN LEAF',   kanji: '葉', symbol: 'leaf',      vx: -0.04, vy: -0.02, color: '#F97316' },
    { id: 'education', label: 'Wits Academy',  guide: 'CS & Applied Math',    tag: 'HIDDEN CLOUD',  kanji: '雲', symbol: 'cloud',     vx: -0.02, vy: -0.28, color: '#FBBF24' },
    { id: 'skills',    label: 'Chakra Dojo',   guide: 'ML, Opt & Tech Stack', tag: 'STONE PEAKS',   kanji: '岩', symbol: 'spiral',    vx: -0.27, vy: -0.10, color: '#22D3EE' },
    { id: 'awards',    label: 'Hall of Fame',  guide: 'Honours & Awards',     tag: 'VALLEY OF END', kanji: '谷', symbol: 'flame',     vx: 0.26,  vy: 0.19,  color: '#A855F7' },
    { id: 'projects',  label: 'Mission Board', guide: 'Projects & Builds',    tag: 'HIDDEN SAND',   kanji: '砂', symbol: 'hourglass', vx: 0.22,  vy: -0.06, color: '#F97316' },
    { id: 'contact',   label: 'Summon Shrine', guide: 'Contact & Dispatch',   tag: 'HIDDEN MIST',   kanji: '霧', symbol: 'paw',       vx: -0.09, vy: 0.25,  color: '#22D3EE' }
  ];
  locations.forEach((l, i) => {
    l.wx = l.vx * W; l.wy = l.vy * W; l.idx = i;
    l.h = 0; l.appearAt = 1.0 + i * 0.3; l.popped = false;
  });
  const locById = (id) => locations.find((l) => l.id === id) || null;

  const routes = [
    ['about', 'education'], ['about', 'skills'], ['about', 'projects'],
    ['about', 'contact'], ['about', 'awards'], ['contact', 'awards']
  ];

  const ZONES = {
    fire:   { x: -30,  y: 10,   r: 230 },
    stone:  { x: -310, y: -40,  r: 250 },
    cloud:  { x: 10,   y: -320, r: 230 },
    sand:   { x: 300,  y: -60,  r: 250 },
    mist:   { x: -90,  y: 300,  r: 230 },
    valley: { x: 270,  y: 200,  r: 170 }
  };
  const zw = (z, x, y) => Math.exp(-(((x - z.x) ** 2 + (y - z.y) ** 2) / (2 * (z.r * 0.55) ** 2)));

  const RIVERS = [
    { w: 12, pts: [[95, -350], [118, -270], [108, -190], [78, -110], [66, -30], [70, 50], [58, 130], [44, 215], [48, 300], [66, 380], [74, 470]] },
    { w: 10, pts: [[270, 46], [262, 100], [258, 170], [272, 250], [298, 330], [322, 440]] }
  ].map((r) => ({ w: r.w, pts: r.pts.map(([x, y]) => ({ x, y })) }));

  const HOKAGE = { x: -90, y: -150 };
  const STATUES = [{ x: 175, y: 150, dir: 1, kind: 0 }, { x: 345, y: 150, dir: -1, kind: 1 }];
  const FALLS = { x: 262, y1: 72, y2: 124 };

  // points that must stay on land (x, y, margin)
  const MUST_LAND = [[345, 150, 45], [175, 150, 45], [-175, -190, 40], [0, -190, 40], [95, -350, 45], [270, 46, 40]];

  /* ════════════════════════════════════════════════════════════════════════
3. COASTLINE  (seeded, validated so every landmark sits on land)
  ════════════════════════════════════════════════════════════════════════ */
  const COAST_N = 360;
  let coast = null; // { r: Float32Array, pts, path }

  function generateCoast(seed) {
    const rnd = mulberry32(seed);
    const lo = [], hi = [];
    for (let k = 2; k <= 11; k++) lo.push([k, 0.085 / Math.pow(k, 0.8) * (0.55 + rnd() * 0.9), rnd() * TAU]);
    for (let k = 13; k <= 47; k += 2) hi.push([k, 0.0105 * Math.pow(13 / k, 0.7) * (0.4 + rnd() * 1.2), rnd() * TAU]);
    const r = new Float32Array(COAST_N);
    for (let i = 0; i < COAST_N; i++) {
      const th = (i / COAST_N) * TAU, c = Math.cos(th), s = Math.sin(th), n = 2.7;
      const base = Math.pow(Math.pow(Math.abs(c) / 0.45, n) + Math.pow(Math.abs(s) / 0.42, n), -1 / n);
      let m = 1;
      for (const [k, a, p] of lo) m += a * Math.sin(k * th + p);
      for (const [k, a, p] of hi) m += a * Math.sin(k * th + p);
      r[i] = base * m * W;
    }
    return r;
  }
  function radiusFrom(r, x, y) {
    let t = Math.atan2(y, x) / TAU; t -= Math.floor(t);
    const f = t * COAST_N, i = Math.floor(f) % COAST_N, k = f - Math.floor(f);
    return lerp(r[i], r[(i + 1) % COAST_N], k);
  }
  function pickCoast() {
    let best = null;
    for (let seed = 1; seed <= 90; seed++) {
      const r = generateCoast(seed);
      let m1 = 1e9, m2 = 1e9;
      for (const l of locations) m1 = Math.min(m1, radiusFrom(r, l.wx, l.wy) - Math.hypot(l.wx, l.wy));
      for (const [x, y, mg] of MUST_LAND) m2 = Math.min(m2, radiusFrom(r, x, y) - Math.hypot(x, y) - mg);
      let dev = 0;
      for (let i = 0; i < COAST_N; i++) dev += Math.abs(r[i] - r[(i + 1) % COAST_N]);
      const score = m1 >= 115 && m2 >= 0 ? dev : Math.min(m1 - 115, m2) - 1e5;
      if (!best || score > best.score) best = { seed, r, score };
    }
    return best.r;
  }
  function buildCoast() {
    const r = pickCoast(), pts = [];
    for (let i = 0; i < COAST_N; i++) {
      const th = (i / COAST_N) * TAU;
      pts.push({ x: Math.cos(th) * r[i], y: Math.sin(th) * r[i] });
    }
    const path = new Path2D();
    smoothClosed(path, pts);
    coast = { r, pts, path };
  }
  const inCoast = (x, y, margin = 0) => Math.hypot(x, y) < radiusFrom(coast.r, x, y) * (1 - margin);

  /* ════════════════════════════════════════════════════════════════════════
4. SYMBOLS + SMALL VECTOR ICONS   (unit space, roughly -1 … 1)
  ════════════════════════════════════════════════════════════════════════ */
  function spiral(c, cx, cy, r0, k, a0, a1, steps = 48) {
    c.beginPath();
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (a1 - a0) * (i / steps), r = r0 + k * (a - a0);
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
  }
  const SYMBOLS = {
    leaf(c, col, bg) {
      c.save(); c.rotate(-0.45);
      c.fillStyle = col; c.beginPath();
      c.moveTo(0, -1.08);
      c.bezierCurveTo(1.0, -0.55, 0.95, 0.5, 0, 0.98);
      c.bezierCurveTo(-0.95, 0.5, -1.0, -0.55, 0, -1.08);
      c.fill();
      c.strokeStyle = bg; c.lineCap = 'round'; c.lineWidth = 0.15;
      spiral(c, 0.02, 0.08, 0.03, 0.058, 0, TAU * 1.55, 44); c.stroke();
      c.beginPath(); c.moveTo(0, 1.0); c.lineTo(0, 0.5); c.stroke();
      c.restore();
    },
    cloud(c, col, bg) {
      c.fillStyle = col;
      [[-0.5, 0.12, 0.36], [0.02, -0.14, 0.5], [0.52, 0.1, 0.38]].forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); });
      c.fillRect(-0.55, 0.1, 1.1, 0.4);
      c.strokeStyle = bg; c.lineCap = 'round'; c.lineWidth = 0.12;
      spiral(c, 0.02, -0.14, 0.03, 0.05, 0, TAU * 1.9, 36); c.stroke();
      c.beginPath(); c.moveTo(-0.62, 0.3); c.lineTo(0.62, 0.3); c.stroke();
    },
    spiral(c, col) {
      c.strokeStyle = col; c.lineCap = 'round'; c.lineWidth = 0.2;
      spiral(c, 0, 0, 0.05, 0.073, 0, TAU * 2.1, 70); c.stroke();
    },
    hourglass(c, col, bg) {
      c.fillStyle = col;
      c.beginPath(); c.moveTo(-0.7, -0.88); c.lineTo(0.7, -0.88); c.lineTo(0.06, -0.02); c.lineTo(0.06, 0.02); c.lineTo(0.7, 0.88); c.lineTo(-0.7, 0.88); c.lineTo(-0.06, 0.02); c.lineTo(-0.06, -0.02); c.closePath(); c.fill();
      c.fillRect(-0.88, -1.02, 1.76, 0.16); c.fillRect(-0.88, 0.86, 1.76, 0.16);
      c.fillStyle = bg;
      c.beginPath(); c.moveTo(-0.4, 0.78); c.lineTo(0.4, 0.78); c.lineTo(0, 0.3); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(-0.45, -0.72); c.lineTo(0.45, -0.72); c.lineTo(0, -0.3); c.closePath(); c.fill();
    },
    paw(c, col) {
      c.fillStyle = col;
      c.beginPath(); c.ellipse(0, 0.38, 0.52, 0.42, 0, 0, TAU); c.fill();
      [[-0.66, -0.06, 0.2, 0.26, -0.35], [-0.24, -0.5, 0.21, 0.28, -0.12], [0.24, -0.5, 0.21, 0.28, 0.12], [0.66, -0.06, 0.2, 0.26, 0.35]]
        .forEach(([x, y, rx, ry, rot]) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); c.fill(); });
    },
    flame(c, col, bg) {
      c.fillStyle = col; c.beginPath();
      c.moveTo(0.08, -1.05);
      c.bezierCurveTo(0.2, -0.55, 0.9, -0.3, 0.82, 0.3);
      c.bezierCurveTo(0.78, 0.78, 0.42, 1.02, 0, 1.02);
      c.bezierCurveTo(-0.46, 1.02, -0.84, 0.72, -0.78, 0.2);
      c.bezierCurveTo(-0.74, -0.1, -0.52, -0.3, -0.34, -0.52);
      c.bezierCurveTo(-0.34, -0.24, -0.22, -0.08, -0.06, -0.04);
      c.bezierCurveTo(0.12, -0.3, 0.02, -0.7, 0.08, -1.05);
      c.closePath(); c.fill();
      c.fillStyle = bg; c.beginPath();
      c.moveTo(0, 0.12); c.bezierCurveTo(0.3, 0.36, 0.44, 0.62, 0.22, 0.82);
      c.bezierCurveTo(0.1, 0.92, -0.16, 0.92, -0.26, 0.72);
      c.bezierCurveTo(-0.36, 0.52, -0.1, 0.36, 0, 0.12); c.closePath(); c.fill();
    }
  };
  function drawSymbol(c, name, x, y, size, col, bg) {
    c.save(); c.translate(x, y); c.scale(size, size);
    SYMBOLS[name](c, col, bg);
    c.restore();
  }
  function drawTomoe(c, x, y, r, rot, col) {
    c.save(); c.translate(x, y); c.rotate(rot); c.fillStyle = col;
    c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
    c.beginPath();
    c.moveTo(r * 0.2, -r * 0.98);
    c.bezierCurveTo(r * 1.6, -r * 1.6, r * 2.8, -r * 0.4, r * 2.4, r * 1.4);
    c.bezierCurveTo(r * 2.2, r * 0.1, r * 1.4, -r * 0.2, r * 0.9, r * 0.45);
    c.closePath(); c.fill();
    c.restore();
  }
  function shurikenPath(c, r) {
    const tips = [0, 1, 2, 3].map((k) => { const a = k * Math.PI / 2 - Math.PI / 2; return [Math.cos(a) * r, Math.sin(a) * r]; });
    c.beginPath(); c.moveTo(tips[0][0], tips[0][1]);
    for (let k = 0; k < 4; k++) {
      const a = (k + 0.5) * Math.PI / 2 - Math.PI / 2, n = tips[(k + 1) % 4];
      c.quadraticCurveTo(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2, n[0], n[1]);
    }
    c.closePath();
  }

  /* ════════════════════════════════════════════════════════════════════════
5. SPRITES  (pre-rendered soft shapes → cheap glow / smoke / cloud)
  ════════════════════════════════════════════════════════════════════════ */
  const spriteCache = new Map();
  function glowSprite(hex) {
    if (spriteCache.has(hex)) return spriteCache.get(hex);
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const c = cv.getContext('2d'), [r, g, b] = hexToRgb(hex);
    const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${r},${g},${b},1)`); gr.addColorStop(0.25, `rgba(${r},${g},${b},0.55)`);
    gr.addColorStop(0.6, `rgba(${r},${g},${b},0.12)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
    spriteCache.set(hex, cv);
    return cv;
  }
  function makePuff() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const c = cv.getContext('2d');
    const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.5, 'rgba(232,232,246,0.55)'); gr.addColorStop(1, 'rgba(226,226,246,0)');
    c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
    return cv;
  }
  function makeCloud(seed) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
    const c = cv.getContext('2d'), rnd = mulberry32(seed);
    for (let i = 0; i < 9; i++) {
      const x = 50 + rnd() * 156, y = 44 + rnd() * 40, r = 26 + rnd() * 34;
      const gr = c.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    return cv;
  }
  const PUFF = makePuff();
  const CLOUDS = [makeCloud(3), makeCloud(8), makeCloud(21)];

  function glow(img, x, y, r, a) {
    if (a <= 0.004 || r <= 0) return;
    const ga = ctx.globalAlpha;
    ctx.globalAlpha = ga * Math.min(1, a);
    ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = ga;
  }

  /* ════════════════════════════════════════════════════════════════════════
6. VIEW STATE + CAMERA
  ════════════════════════════════════════════════════════════════════════ */
  let width = 0, height = 0, dpr = 1, isPortrait = false;
  let baseScale = 0.8, vcx = 0, vcy = 0;
  let time = 0, introT = 0;
  const INTRO_TOTAL = 3.6;
  const home = { x: 0, y: 0, z: 1 };
  const cam = { x: 0, y: 0, z: 1 };
  const tgt = { x: 0, y: 0, z: 1 };
  const vel = { x: 0, y: 0 };
  let flying = false, arrive = null;
  let hovered = null;
  const mouse = { x: -9999, y: -9999, inside: false };
  let bgCanvas = null, vignetteCanvas = null, seigaiha = null;

  function w2s(x, y, c = cam) { const S = baseScale * c.z; return { x: vcx + (x - c.x) * S, y: vcy + (y - c.y) * S }; }
  function s2w(x, y, c = cam) { const S = baseScale * c.z; return { x: c.x + (x - vcx) / S, y: c.y + (y - vcy) / S }; }
  function setWorldTransform() {
    const S = baseScale * cam.z;
    ctx.setTransform(dpr * S, 0, 0, dpr * S, dpr * (vcx - cam.x * S), dpr * (vcy - cam.y * S));
  }
  const setScreenTransform = () => ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const pinBase = () => clamp(Math.min(width, height) * 0.027, 15, 25) * (1 + (cam.z - 1) * 0.28);

  function layout() {
    isPortrait = height > width * 1.05;
    const fitX = (width * 0.95) / 960;
    const fitY = (height * (isPortrait ? 0.6 : 0.76)) / 900;
    baseScale = Math.min(fitX, fitY);
    vcx = width / 2;
    vcy = height * (isPortrait ? 0.53 : 0.545);
    home.z = isPortrait ? 1.18 : 1;
  }

  /* ════════════════════════════════════════════════════════════════════════
7. STATIC TERRAIN  (painted once into an off-screen canvas, world space)
  ════════════════════════════════════════════════════════════════════════ */
  const TERR_HALF = 600;
  let terrain = null, terrainR = 0;
  const lights = [];   // warm window / lantern glows (world coords)
  let islets = [];

  const wantTerrainR = () => clamp(baseScale * dpr * 2, 1.1, 2600 / (TERR_HALF * 2));

  function buildTerrain() {
    terrainR = wantTerrainR();
    const R = terrainR, px = Math.ceil(TERR_HALF * 2 * R);
    terrain = document.createElement('canvas');
    terrain.width = px; terrain.height = px;
    const t = terrain.getContext('2d');
    t.setTransform(R, 0, 0, R, px / 2, px / 2);
    t.lineJoin = 'round'; t.lineCap = 'round';
    const rnd = mulberry32(20260301);
    lights.length = 0;

    paintGround(t);
    t.save(); t.clip(coast.path);
    paintWashes(t);
    paintContours(t);
    paintSpeckles(t, rnd);
    paintRiversAndLakes(t);
    paintDunes(t, rnd);
    paintValleyWalls(t, rnd);
    paintMountains(t, rnd);
    paintTrees(t, rnd);
    paintVillages(t, rnd);
    paintHokageRock(t);
    paintStatues(t);
    t.restore();
    paintShore(t, rnd);
    buildIslets();
  }

  function paintGround(t) {
    [[70, 0.045], [46, 0.065], [28, 0.09], [15, 0.13]].forEach(([w, a]) => {
      t.lineWidth = w; t.strokeStyle = `rgba(56,200,230,${a})`; t.stroke(coast.path);
    });
    const g = t.createRadialGradient(-30, 0, 20, -30, 0, 560);
    g.addColorStop(0, '#2f4d33'); g.addColorStop(0.55, '#243d2c'); g.addColorStop(1, '#1b2d28');
    t.fillStyle = g; t.fill(coast.path);
  }
  function wash(t, x, y, r, rgb, a) {
    const g = t.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
    t.fillStyle = g; t.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function paintWashes(t) {
    wash(t, ZONES.stone.x, ZONES.stone.y, 280, '128,100,78', 0.72);
    wash(t, ZONES.sand.x, ZONES.sand.y, 280, '222,166,84', 0.64);
    wash(t, ZONES.cloud.x, ZONES.cloud.y, 260, '128,158,196', 0.52);
    wash(t, ZONES.mist.x, ZONES.mist.y, 260, '88,160,176', 0.54);
    wash(t, ZONES.valley.x, ZONES.valley.y, 200, '130,86,160', 0.46);
    wash(t, ZONES.fire.x, ZONES.fire.y, 280, '44,172,78', 0.6);
  }
  function paintContours(t) {
    [0.95, 0.88, 0.81, 0.74, 0.67, 0.6, 0.53].forEach((s) => {
      t.save(); t.scale(s, s); t.lineWidth = 1.3 / s; t.strokeStyle = 'rgba(255,236,170,0.075)'; t.stroke(coast.path); t.restore();
    });
  }
  function paintSpeckles(t, rnd) {
    for (let i = 0; i < 2600; i++) {
      const x = (rnd() * 2 - 1) * 480, y = (rnd() * 2 - 1) * 460;
      if (!inCoast(x, y, 0.02)) continue;
      const l = rnd() < 0.5;
      t.fillStyle = l ? `rgba(255,255,230,${0.03 + rnd() * 0.05})` : `rgba(0,0,0,${0.05 + rnd() * 0.08})`;
      t.beginPath(); t.arc(x, y, 0.8 + rnd() * 2.2, 0, TAU); t.fill();
    }
  }
  function paintRiversAndLakes(t) {
    for (const r of RIVERS) {
      r.path = new Path2D(); smoothOpen(r.path, r.pts);
      t.strokeStyle = 'rgba(6,24,38,0.78)'; t.lineWidth = r.w + 7; t.stroke(r.path);
      t.strokeStyle = '#1b86a8'; t.lineWidth = r.w; t.stroke(r.path);
      t.strokeStyle = 'rgba(130,230,248,0.6)'; t.lineWidth = r.w * 0.38; t.stroke(r.path);
    }
    const lake = (x, y, rx, ry) => {
      t.fillStyle = 'rgba(5,22,36,0.8)'; t.beginPath(); t.ellipse(x, y + 1.5, rx + 4, ry + 4, 0, 0, TAU); t.fill();
      const g = t.createRadialGradient(x - rx * 0.3, y - ry * 0.3, 1, x, y, rx);
      g.addColorStop(0, '#5fd0ea'); g.addColorStop(1, '#1b7fa3');
      t.fillStyle = g; t.beginPath(); t.ellipse(x, y, rx, ry, 0, 0, TAU); t.fill();
      t.strokeStyle = 'rgba(200,245,255,0.5)'; t.lineWidth = 1.2; t.stroke();
    };
    lake(95, -352, 34, 19);
    lake(270, 44, 20, 12);
    [[-230, 300, 30, 15], [-160, 362, 24, 12], [-30, 362, 28, 14], [-215, 212, 20, 11], [-2, 302, 18, 10]].forEach((l) => lake(...l));
  }
  function paintDunes(t, rnd) {
    for (let i = 0; i < 520; i++) {
      const x = ZONES.sand.x + (rnd() * 2 - 1) * 250, y = ZONES.sand.y + (rnd() * 2 - 1) * 250;
      if (!inCoast(x, y, 0.06) || zw(ZONES.sand, x, y) < 0.3 || rnd() > zw(ZONES.sand, x, y)) continue;
      if (locations.some((l) => Math.hypot(x - l.wx, y - l.wy) < 64)) continue;
      if (RIVERS.some((r) => distToPolyline(x, y, r.pts) < 22)) continue;
      const w = 9 + rnd() * 14;
      t.lineWidth = 1.8; t.strokeStyle = 'rgba(255,226,160,0.3)';
      t.beginPath(); t.moveTo(x - w, y); t.quadraticCurveTo(x, y - w * 0.5, x + w, y); t.stroke();
      t.strokeStyle = 'rgba(90,50,10,0.22)';
      t.beginPath(); t.moveTo(x - w * 0.8, y + 2.4); t.quadraticCurveTo(x, y - w * 0.3 + 2.4, x + w * 0.8, y + 2.4); t.stroke();
    }
    // a few cacti
    for (let i = 0; i < 14; i++) {
      const x = ZONES.sand.x + (rnd() * 2 - 1) * 200, y = ZONES.sand.y + (rnd() * 2 - 1) * 200;
      if (!inCoast(x, y, 0.08) || locations.some((l) => Math.hypot(x - l.wx, y - l.wy) < 70)) continue;
      t.strokeStyle = '#3f8f4b'; t.lineWidth = 2.6;
      t.beginPath(); t.moveTo(x, y + 5); t.lineTo(x, y - 5); t.moveTo(x, y + 1); t.lineTo(x - 4, y + 1); t.lineTo(x - 4, y - 3); t.moveTo(x, y - 1); t.lineTo(x + 4, y - 1); t.lineTo(x + 4, y - 4); t.stroke();
    }
  }
  function paintValleyWalls(t, rnd) {
    const rp = RIVERS[1].pts;
    for (const side of [-1, 1]) {
      const pts = [];
      for (let y = 52; y <= 238; y += 9) pts.push([xAtY(rp, y) + side * ((y < 130 ? 26 : 17) + rnd() * 9), y]);
      t.beginPath(); t.moveTo(pts[0][0], pts[0][1]);
      pts.forEach((p) => t.lineTo(p[0], p[1]));
      for (let i = pts.length - 1; i >= 0; i--) t.lineTo(xAtY(rp, pts[i][1]) + side * 9, pts[i][1]);
      t.closePath();
      t.fillStyle = 'rgba(34,26,44,0.9)'; t.fill();
      t.strokeStyle = 'rgba(205,185,235,0.3)'; t.lineWidth = 1.2; t.stroke();
    }
    // waterfall body + plunge pool
    const g = t.createLinearGradient(0, FALLS.y1, 0, FALLS.y2);
    g.addColorStop(0, 'rgba(210,240,255,0.5)'); g.addColorStop(1, 'rgba(240,252,255,0.95)');
    t.fillStyle = g; t.fillRect(FALLS.x - 9, FALLS.y1, 18, FALLS.y2 - FALLS.y1);
    t.fillStyle = 'rgba(120,225,245,0.5)'; t.beginPath(); t.ellipse(FALLS.x, FALLS.y2 + 6, 30, 12, 0, 0, TAU); t.fill();
    t.fillStyle = 'rgba(255,255,255,0.7)'; t.beginPath(); t.ellipse(FALLS.x, FALLS.y2 + 2, 17, 5, 0, 0, TAU); t.fill();
  }

  function scatter(rnd, tries, minDist, prob, ok) {
    const out = [], md2 = minDist * minDist;
    for (let i = 0; i < tries; i++) {
      const x = (rnd() * 2 - 1) * 480, y = (rnd() * 2 - 1) * 460;
      if (!inCoast(x, y, 0.05) || rnd() > prob(x, y) || !ok(x, y)) continue;
      let good = true;
      for (let j = 0; j < out.length; j++) { const o = out[j]; if ((o.x - x) ** 2 + (o.y - y) ** 2 < md2) { good = false; break; } }
      if (good) out.push({ x, y });
    }
    return out;
  }
  const inRect = (x, y, x0, y0, x1, y1) => x > x0 && x < x1 && y > y0 && y < y1;
  const blockedLandmark = (x, y) =>
    inRect(x, y, -190, -208, 14, -98) || inRect(x, y, 150, 30, 372, 252) || Math.hypot(x - 95, y + 352) < 46;

  function paintMountains(t, rnd) {
    const list = scatter(rnd, 3200, 30,
      (x, y) => clamp(1.25 * zw(ZONES.stone, x, y) + 0.95 * zw(ZONES.cloud, x, y) + 0.3 * zw(ZONES.valley, x, y) + 0.04 - 0.9 * zw(ZONES.sand, x, y) - 0.6 * zw(ZONES.fire, x, y), 0, 1) * 0.6,
      (x, y) => !blockedLandmark(x, y) && locations.every((l) => Math.hypot(x - l.wx, y - l.wy) > 104) && RIVERS.every((r) => distToPolyline(x, y, r.pts) > 26));
    list.sort((a, b) => a.y - b.y);
    for (const m of list) {
      const cloudy = zw(ZONES.cloud, m.x, m.y) > zw(ZONES.stone, m.x, m.y);
      const s = (cloudy ? 17 : 14) + rnd() * 18 + (cloudy ? 0 : zw(ZONES.stone, m.x, m.y) * 6);
      const lit = cloudy ? '#a9bdd6' : '#9a8570', dark = cloudy ? '#5b7189' : '#5a4a3c';
      t.fillStyle = 'rgba(0,0,0,0.3)'; t.beginPath(); t.ellipse(m.x + s * 0.3, m.y + s * 0.55, s * 1.05, s * 0.3, 0, 0, TAU); t.fill();
      t.fillStyle = lit; t.beginPath(); t.moveTo(m.x - s * 0.95, m.y + s * 0.5); t.lineTo(m.x, m.y - s); t.lineTo(m.x + s * 0.14, m.y + s * 0.5); t.closePath(); t.fill();
      t.fillStyle = dark; t.beginPath(); t.moveTo(m.x, m.y - s); t.lineTo(m.x + s, m.y + s * 0.5); t.lineTo(m.x + s * 0.14, m.y + s * 0.5); t.closePath(); t.fill();
      t.strokeStyle = 'rgba(20,14,10,0.45)'; t.lineWidth = 0.9;
      t.beginPath(); t.moveTo(m.x, m.y - s); t.lineTo(m.x + s * 0.14, m.y + s * 0.5); t.stroke();
      if (cloudy || s > 26) {
        t.fillStyle = 'rgba(244,250,255,0.92)'; t.beginPath();
        t.moveTo(m.x, m.y - s); t.lineTo(m.x - s * 0.3, m.y - s * 0.42); t.lineTo(m.x - s * 0.1, m.y - s * 0.55);
        t.lineTo(m.x + s * 0.04, m.y - s * 0.36); t.lineTo(m.x + s * 0.2, m.y - s * 0.52); t.lineTo(m.x + s * 0.32, m.y - s * 0.4); t.closePath(); t.fill();
      }
    }
  }
  function paintTrees(t, rnd) {
    const list = scatter(rnd, 8000, 8.5,
      (x, y) => clamp(0.07 + 1.05 * zw(ZONES.fire, x, y) + 0.3 * zw(ZONES.mist, x, y) + 0.12 * zw(ZONES.valley, x, y) - 0.95 * zw(ZONES.sand, x, y) - 0.85 * zw(ZONES.stone, x, y) - 0.5 * zw(ZONES.cloud, x, y), 0, 1),
      (x, y) => !blockedLandmark(x, y) && locations.every((l) => Math.hypot(x - l.wx, y - l.wy) > 40) && RIVERS.every((r) => distToPolyline(x, y, r.pts) > 14));
    list.sort((a, b) => a.y - b.y);
    for (const p of list) {
      const r = 5 + rnd() * 3.6, mist = zw(ZONES.mist, p.x, p.y) > 0.5;
      const autumn = rnd() < 0.07;
      const hue = autumn ? 18 + rnd() * 24 : (mist ? 150 : 104) + rnd() * 34;
      const sat = autumn ? 70 : 46;
      t.fillStyle = 'rgba(0,10,5,0.36)'; t.beginPath(); t.ellipse(p.x + r * 0.4, p.y + r * 0.6, r * 0.95, r * 0.55, 0, 0, TAU); t.fill();
      t.fillStyle = `hsl(${hue},${sat}%,20%)`; t.beginPath(); t.arc(p.x, p.y, r, 0, TAU); t.fill();
      t.fillStyle = `hsl(${hue},${sat + 5}%,31%)`; t.beginPath(); t.arc(p.x - r * 0.2, p.y - r * 0.25, r * 0.7, 0, TAU); t.fill();
      t.fillStyle = `hsla(${hue},62%,55%,0.6)`; t.beginPath(); t.arc(p.x - r * 0.36, p.y - r * 0.42, r * 0.3, 0, TAU); t.fill();
    }
  }

  const ROOFS = {
    about: ['#c2410c', '#ea580c', '#b45309', '#9a3412'],
    education: ['#64748b', '#94a3b8', '#475569', '#cbd5e1'],
    skills: ['#78716c', '#a8a29e', '#57534e', '#8a6f55'],
    projects: ['#d6a35c', '#b9884a', '#e0b877', '#a87b3c'],
    contact: ['#0f766e', '#14b8a6', '#115e59', '#2a9d8f']
  };
  function paintVillages(t, rnd) {
    for (const l of locations) {
      const pal = ROOFS[l.id];
      if (!pal) continue;
      // roads
      t.strokeStyle = 'rgba(228,192,132,0.34)'; t.lineWidth = 3.2;
      const spokes = 6 + (l.idx % 3);
      for (let i = 0; i < spokes; i++) {
        const a = (i / spokes) * TAU + rnd() * 0.4;
        t.beginPath(); t.moveTo(l.wx + Math.cos(a) * 14, l.wy + Math.sin(a) * 14); t.lineTo(l.wx + Math.cos(a) * 88, l.wy + Math.sin(a) * 88); t.stroke();
      }
      // village wall
      t.lineWidth = 4.5; t.strokeStyle = 'rgba(5,10,12,0.5)'; t.beginPath(); t.arc(l.wx, l.wy, 92, 0, TAU); t.stroke();
      t.lineWidth = 1.5; t.strokeStyle = rgba(l.color, 0.4); t.stroke();
      // houses (little front-facing huts, painter-sorted by y)
      const items = [];
      for (let tries = 0; tries < 600 && items.length < 22; tries++) {
        const a = rnd() * TAU, d = 40 + rnd() * 40;
        const x = l.wx + Math.cos(a) * d, y = l.wy + Math.sin(a) * d;
        if (!inCoast(x, y, 0.03) || RIVERS.some((r) => distToPolyline(x, y, r.pts) < 20)) continue;
        if (items.some((o) => Math.abs(o.x - x) < 17 && Math.abs(o.y - y) < 13)) continue;
        items.push({ x, y, w: 12 + rnd() * 6, h: 9 + rnd() * 4, c: Math.floor(rnd() * pal.length), lamp: rnd() < 0.45 });
      }
      items.sort((p, q) => p.y - q.y);
      for (const h of items) {
        t.fillStyle = 'rgba(0,0,0,0.38)'; t.beginPath(); t.ellipse(h.x + 3, h.y + h.h * 0.5, h.w * 0.7, h.h * 0.22, 0, 0, TAU); t.fill();
        t.fillStyle = '#3b2f25'; t.fillRect(h.x - h.w / 2, h.y - h.h * 0.12, h.w, h.h * 0.62);
        t.fillStyle = 'rgba(255,255,255,0.1)'; t.fillRect(h.x - h.w / 2, h.y - h.h * 0.12, h.w, 1);
        t.fillStyle = pal[h.c]; t.beginPath();
        t.moveTo(h.x - h.w / 2 - 2.2, h.y - h.h * 0.1); t.lineTo(h.x, h.y - h.h * 0.98); t.lineTo(h.x + h.w / 2 + 2.2, h.y - h.h * 0.1); t.closePath(); t.fill();
        t.fillStyle = 'rgba(0,0,0,0.3)'; t.beginPath();
        t.moveTo(h.x, h.y - h.h * 0.98); t.lineTo(h.x + h.w / 2 + 2.2, h.y - h.h * 0.1); t.lineTo(h.x, h.y - h.h * 0.1); t.closePath(); t.fill();
        if (h.lamp) { t.fillStyle = '#fde68a'; t.fillRect(h.x - 1.6, h.y + h.h * 0.08, 3.2, 3.4); lights.push({ x: h.x, y: h.y + h.h * 0.22, ph: rnd() * TAU }); }
      }
    }
  }

  function paintHokageRock(t) {
    t.save(); t.translate(HOKAGE.x, HOKAGE.y);
    t.fillStyle = 'rgba(0,0,0,0.38)'; t.beginPath(); t.ellipse(6, 36, 90, 13, 0, 0, TAU); t.fill();
    const gr = t.createLinearGradient(0, -40, 0, 36);
    gr.addColorStop(0, '#c2b6a2'); gr.addColorStop(0.5, '#8f8471'); gr.addColorStop(1, '#585043');
    t.fillStyle = gr; t.beginPath();
    t.moveTo(-82, 34); t.lineTo(-84, -8); t.lineTo(-76, -24); t.lineTo(-60, -30); t.lineTo(-44, -37); t.lineTo(-20, -34);
    t.lineTo(0, -41); t.lineTo(22, -35); t.lineTo(46, -39); t.lineTo(64, -28); t.lineTo(79, -20); t.lineTo(85, 0); t.lineTo(81, 34);
    t.closePath(); t.fill();
    t.strokeStyle = 'rgba(30,22,14,0.55)'; t.lineWidth = 1.4; t.stroke();
    // grassy top edge
    t.strokeStyle = '#4d9a52'; t.lineWidth = 4;
    t.beginPath(); t.moveTo(-76, -24); t.lineTo(-60, -30); t.lineTo(-44, -37); t.lineTo(-20, -34); t.lineTo(0, -41); t.lineTo(22, -35); t.lineTo(46, -39); t.lineTo(64, -28); t.lineTo(79, -20); t.stroke();
    // strata
    t.strokeStyle = 'rgba(20,14,8,0.16)'; t.lineWidth = 1;
    for (let i = 0; i < 6; i++) { const y = -26 + i * 11; t.beginPath(); t.moveTo(-82, y + (i % 2) * 3); t.lineTo(84, y - (i % 2) * 3); t.stroke(); }
    // five carved heads
    const stone = '#d9cfbb', hair = '#6d6454';
    for (let i = 0; i < 5; i++) {
      const hx = -62 + i * 31;
      t.save(); t.translate(hx, -1);
      t.fillStyle = hair;
      if (i === 0) { t.beginPath(); t.moveTo(-11, -12); t.quadraticCurveTo(-16, 2, -13, 17); t.lineTo(13, 17); t.quadraticCurveTo(16, 2, 11, -12); t.quadraticCurveTo(0, -25, -11, -12); t.fill(); }
      if (i === 4) { [-1, 1].forEach((s) => { t.beginPath(); t.ellipse(s * 14, 6, 4.6, 12, s * 0.15, 0, TAU); t.fill(); }); }
      t.fillStyle = stone; roundRectPath(t, -9, -11, 18, 23, 8); t.fill();
      t.fillStyle = hair;
      if (i === 0) { t.beginPath(); t.moveTo(-10, -4); t.quadraticCurveTo(0, -17, 10, -4); t.lineTo(10, -10); t.quadraticCurveTo(0, -20, -10, -10); t.fill(); }
      else if (i === 1 || i === 3) {
        const n = i === 1 ? 5 : 4, tall = i === 1 ? 7 : 12;
        for (let k = 0; k < n; k++) { const x = -9 + (k + 0.5) * (18 / n); t.beginPath(); t.moveTo(x - 3, -9); t.lineTo(x + (k - n / 2) * 0.9, -9 - tall - (k % 2) * 3); t.lineTo(x + 3, -9); t.fill(); }
        t.fillRect(-9, -11, 18, 4);
      } else if (i === 2) { roundRectPath(t, -11, -19, 22, 11, 4); t.fill(); t.fillStyle = '#b84f3a'; t.fillRect(-4, -17, 8, 5); }
      else { t.beginPath(); t.arc(0, -15, 5, 0, TAU); t.fill(); t.fillRect(-9, -11, 18, 4); }
      t.strokeStyle = 'rgba(40,30,22,0.7)'; t.lineWidth = 1; t.beginPath();
      t.moveTo(-6, -3); t.lineTo(-2.5, -3); t.moveTo(2.5, -3); t.lineTo(6, -3); t.moveTo(0, -2); t.lineTo(0, 3); t.moveTo(-3, 7); t.lineTo(3, 7); t.stroke();
      t.restore();
    }
    t.restore();
  }

  function drawStatue(t, s) {
    t.save(); t.translate(s.x, s.y); t.scale(s.dir * 1.3, 1.3);
    t.fillStyle = 'rgba(0,0,0,0.4)'; t.beginPath(); t.ellipse(2, 28, 27, 8, 0, 0, TAU); t.fill();
    t.fillStyle = '#4b4258'; t.beginPath(); t.moveTo(-25, 28); t.lineTo(-17, 14); t.lineTo(17, 14); t.lineTo(25, 28); t.closePath(); t.fill();
    t.fillStyle = '#665c79'; t.fillRect(-17, 12, 34, 4);
    const g = t.createLinearGradient(-12, 0, 12, 0);
    g.addColorStop(0, '#cfc6dc'); g.addColorStop(0.55, '#9087a1'); g.addColorStop(1, '#5d556b');
    t.fillStyle = g; t.beginPath(); t.moveTo(-9, -8); t.lineTo(9, -8); t.lineTo(13, 14); t.lineTo(-13, 14); t.closePath(); t.fill();
    t.strokeStyle = 'rgba(30,24,40,0.35)'; t.lineWidth = 1; t.beginPath(); t.moveTo(-4, -4); t.lineTo(-6, 14); t.moveTo(3, -4); t.lineTo(5, 14); t.stroke();
    t.strokeStyle = '#a89fb8'; t.lineWidth = 5; t.beginPath(); t.moveTo(6, -5); t.lineTo(17, -15); t.stroke();
    t.fillStyle = '#cfc6dc'; t.beginPath(); t.arc(18.5, -16.5, 3.2, 0, TAU); t.fill();
    t.strokeStyle = '#8f869f'; t.lineWidth = 4.5; t.beginPath(); t.moveTo(-7, -5); t.lineTo(-10, 9); t.stroke();
    t.fillStyle = '#5d556b';
    if (s.kind === 0) {
      t.beginPath(); t.moveTo(-3, -23); t.quadraticCurveTo(-12, -12, -10, 0); t.lineTo(7, 0); t.quadraticCurveTo(11, -12, 5, -23); t.closePath(); t.fill();
    } else {
      for (let i = 0; i < 6; i++) {
        const a = Math.PI * 1.05 + i * 0.3, cx = 1 + Math.cos(a) * 5, cy = -17 + Math.sin(a) * 5;
        const tx = 1 + Math.cos(a) * (14 + (i % 2) * 4), ty = -17 + Math.sin(a) * (14 + (i % 2) * 4);
        t.beginPath(); t.moveTo(cx - Math.sin(a) * 3, cy + Math.cos(a) * 3); t.lineTo(tx, ty); t.lineTo(cx + Math.sin(a) * 3, cy - Math.cos(a) * 3); t.closePath(); t.fill();
      }
    }
    t.fillStyle = '#d6cee3'; t.beginPath(); t.arc(1, -17, 6.4, 0, TAU); t.fill();
    t.fillStyle = '#5d556b';
    if (s.kind === 0) { t.beginPath(); t.moveTo(-5.4, -17); t.quadraticCurveTo(1, -27, 7.4, -17); t.lineTo(7, -20); t.quadraticCurveTo(1, -26, -5, -20); t.fill(); }
    t.strokeStyle = 'rgba(30,24,40,0.75)'; t.lineWidth = 0.9; t.beginPath(); t.moveTo(3, -17.5); t.lineTo(6, -17.5); t.stroke();
    t.restore();
  }
  function paintStatues(t) { STATUES.forEach((s) => drawStatue(t, s)); }

  function paintShore(t, rnd) {
    t.lineJoin = 'round';
    t.lineWidth = 16; t.strokeStyle = 'rgba(236,206,150,0.22)'; t.stroke(coast.path);
    t.lineWidth = 7; t.strokeStyle = 'rgba(250,230,180,0.3)'; t.stroke(coast.path);
    t.lineWidth = 2.4; t.strokeStyle = 'rgba(251,191,36,0.88)'; t.stroke(coast.path);
    t.lineWidth = 0.8; t.strokeStyle = 'rgba(255,246,210,0.75)'; t.stroke(coast.path);
    for (let i = 0; i < 520; i++) {
      const p = coast.pts[Math.floor(rnd() * coast.pts.length)], d = Math.hypot(p.x, p.y), off = 4 + rnd() * 16;
      t.fillStyle = `rgba(230,250,255,${0.1 + rnd() * 0.22})`;
      t.beginPath(); t.arc(p.x + (p.x / d) * off, p.y + (p.y / d) * off, 0.8 + rnd() * 2, 0, TAU); t.fill();
    }
  }

  /* — small sea islets (cached separately so they can sit outside the terrain bitmap) — */
  const ISLET_DEFS = [
    { x: 840, y: -250, rad: 78, seed: 5, torii: true },
    { x: 905, y: 255, rad: 52, seed: 9 },
    { x: 770, y: 400, rad: 36, seed: 14 },
    { x: -860, y: -300, rad: 46, seed: 17 }
  ];
  function buildIslets() {
    const R = terrainR * 0.9;
    islets = ISLET_DEFS.map((d) => {
      const half = d.rad * 1.7, px = Math.ceil(half * 2 * R);
      const cv = document.createElement('canvas'); cv.width = cv.height = px;
      const t = cv.getContext('2d'); t.setTransform(R, 0, 0, R, px / 2, px / 2);
      t.lineJoin = 'round'; t.lineCap = 'round';
      const rnd = mulberry32(d.seed), ph = [rnd() * TAU, rnd() * TAU, rnd() * TAU], pts = [];
      for (let i = 0; i < 60; i++) {
        const th = (i / 60) * TAU, m = 1 + 0.18 * Math.sin(2 * th + ph[0]) + 0.1 * Math.sin(3 * th + ph[1]) + 0.06 * Math.sin(5 * th + ph[2]);
        pts.push({ x: Math.cos(th) * d.rad * m, y: Math.sin(th) * d.rad * m * 0.78 });
      }
      const path = new Path2D(); smoothClosed(path, pts);
      [[34, 0.06], [20, 0.1], [10, 0.16]].forEach(([w, a]) => { t.lineWidth = w; t.strokeStyle = `rgba(56,200,230,${a})`; t.stroke(path); });
      const g = t.createRadialGradient(-d.rad * 0.2, -d.rad * 0.2, 4, 0, 0, d.rad * 1.1);
      g.addColorStop(0, '#34573a'); g.addColorStop(1, '#1f3329');
      t.fillStyle = g; t.fill(path);
      t.lineWidth = 6; t.strokeStyle = 'rgba(240,215,160,0.3)'; t.stroke(path);
      t.lineWidth = 1.8; t.strokeStyle = 'rgba(251,191,36,0.8)'; t.stroke(path);
      t.save(); t.clip(path);
      for (let i = 0; i < 16; i++) {
        const a = rnd() * TAU, dd = Math.sqrt(rnd()) * d.rad * 0.65, x = Math.cos(a) * dd, y = Math.sin(a) * dd * 0.78, s = 6 + rnd() * 6;
        t.fillStyle = 'rgba(0,0,0,0.3)'; t.beginPath(); t.ellipse(x + 2, y + s * 0.5, s * 0.7, s * 0.3, 0, 0, TAU); t.fill();
        t.fillStyle = '#16402a'; t.beginPath(); t.moveTo(x, y - s * 1.3); t.lineTo(x + s * 0.7, y + s * 0.4); t.lineTo(x - s * 0.7, y + s * 0.4); t.closePath(); t.fill();
        t.fillStyle = '#2a6a45'; t.beginPath(); t.moveTo(x, y - s * 1.3); t.lineTo(x - s * 0.7, y + s * 0.4); t.lineTo(x - s * 0.05, y + s * 0.4); t.closePath(); t.fill();
      }
      t.restore();
      if (d.torii) {
        t.save(); t.translate(d.rad * 0.12, d.rad * 0.1);
        t.fillStyle = 'rgba(0,0,0,0.35)'; t.beginPath(); t.ellipse(2, 12, 16, 4, 0, 0, TAU); t.fill();
        t.fillStyle = '#d9381e'; t.fillRect(-12, -14, 4, 26); t.fillRect(8, -14, 4, 26);
        t.beginPath(); t.moveTo(-18, -16); t.quadraticCurveTo(0, -22, 18, -16); t.lineTo(18, -11); t.quadraticCurveTo(0, -17, -18, -11); t.closePath(); t.fill();
        t.fillRect(-13, -7, 26, 3.4);
        t.fillStyle = '#1a1a1a'; t.fillRect(-18, -17.5, 36, 1.6);
        t.restore();
      }
      return { cv, half, x: d.x, y: d.y };
    });
  }

  /* ════════════════════════════════════════════════════════════════════════
8. SCREEN LAYERS  (background, seigaiha wave pattern, vignette)
  ════════════════════════════════════════════════════════════════════════ */
  function softBlob(c, x, y, r, rgb, a) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function buildScreenLayers() {
    const mk = () => { const cv = document.createElement('canvas'); cv.width = Math.round(width * dpr); cv.height = Math.round(height * dpr); const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); return [cv, c]; };
    let [cv, c] = mk(); bgCanvas = cv;
    const cx = width / 2, cy = height * 0.52, big = Math.max(width, height);
    let g = c.createRadialGradient(cx, cy, 30, cx, cy, big * 0.78);
    g.addColorStop(0, '#12365a'); g.addColorStop(0.42, '#0a2039'); g.addColorStop(1, '#030814');
    c.fillStyle = g; c.fillRect(0, 0, width, height);
    softBlob(c, width * 0.16, height * 0.86, big * 0.45, '249,115,22', 0.09);
    softBlob(c, width * 0.86, height * 0.16, big * 0.45, '34,211,238', 0.1);
    softBlob(c, cx, cy, Math.min(width, height) * 0.8, '34,211,238', 0.09);

    [cv, c] = mk(); vignetteCanvas = cv;
    g = c.createRadialGradient(cx, cy, Math.min(width, height) * 0.35, cx, cy, big * 0.8);
    g.addColorStop(0, 'rgba(2,4,10,0)'); g.addColorStop(1, 'rgba(2,4,10,0.78)');
    c.fillStyle = g; c.fillRect(0, 0, width, height);

    // seigaiha (traditional Japanese wave scales) tile — black fill + cyan rings, blended with 'screen'
    const sc = Math.min(2, dpr), tile = document.createElement('canvas');
    tile.width = 64 * sc; tile.height = 32 * sc;
    const tc = tile.getContext('2d'); tc.scale(sc, sc); tc.fillStyle = '#000'; tc.lineWidth = 1;
    for (let row = -2; row <= 4; row++) {
      const cy2 = row * 16, off = row & 1 ? 32 : 0;
      for (let x = off - 64; x <= 128; x += 64) {
        tc.beginPath(); tc.arc(x, cy2, 32, 0, TAU); tc.fill();
        for (let k = 0; k < 4; k++) { tc.beginPath(); tc.arc(x, cy2, 31 - k * 7.5, 0, TAU); tc.strokeStyle = `rgba(90,200,235,${0.95 - k * 0.2})`; tc.stroke(); }
      }
    }
    try {
      seigaiha = ctx.createPattern(tile, 'repeat');
      if (seigaiha.setTransform) seigaiha.setTransform(new DOMMatrix([1 / sc, 0, 0, 1 / sc, 0, 0]));
    } catch (e) { seigaiha = null; }
  }

  /* ════════════════════════════════════════════════════════════════════════
9. PARTICLES + AMBIENT ACTORS
  ════════════════════════════════════════════════════════════════════════ */
  const smoke = [], sparks = [], rings = [];
  let bolt = null, nextBolt = 3.2;
  const leaves = [], fireflies = [], sandBits = [], motes = [], fogs = [], clouds = [];
  const crows = [];
  let crowTimer = 7;
  const SHIPS = [
    { a: 0.4, speed: 0.034, rx: 640, ry: 520, ph: 0 },
    { a: 3.5, speed: -0.027, rx: 700, ry: 560, ph: 2 }
  ];
  const WHIRL = { x: -820, y: 300, r: 130 };
  const hasLS = 'letterSpacing' in ctx;

  function spawnLeaf(initial) {
    const z = ZONES.fire, a = Math.random() * TAU, d = Math.sqrt(Math.random()) * z.r * 0.85;
    return {
      x: z.x + Math.cos(a) * d - (initial ? 0 : 50), y: z.y + Math.sin(a) * d,
      vx: rand(20, 38), vy: rand(-10, 8), rot: rand(0, TAU), vr: rand(-2.5, 2.5), sw: rand(0, TAU),
      size: rand(6, 9.5), life: initial ? rand(0, 9) : 0, max: rand(11, 18), autumn: Math.random() < 0.3
    };
  }
  function initAmbient() {
    const nLeaf = REDUCED ? 8 : 26, nFly = REDUCED ? 10 : 28, nSand = REDUCED ? 14 : 46, nMote = REDUCED ? 18 : 52;
    for (let i = 0; i < nLeaf; i++) leaves.push(spawnLeaf(true));
    for (let i = 0; i < nFly; i++) {
      const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * 220;
      fireflies.push({ ox: ZONES.fire.x + Math.cos(a) * d, oy: ZONES.fire.y + Math.sin(a) * d * 0.9, ph: rand(0, TAU), sp: rand(0.4, 1) });
    }
    for (let i = 0; i < nSand; i++) sandBits.push({ x: rand(170, 400), y: rand(-250, 80), v: rand(55, 110), len: rand(12, 28), a: rand(0.14, 0.34) });
    for (let i = 0; i < nMote; i++) {
      motes.push({ x: rand(-820, 820), y: rand(-560, 560), vy: -rand(4, 13), ph: rand(0, TAU), r: rand(1.3, 3), c: ['#22D3EE', '#FBBF24', '#F97316', '#FDE68A'][Math.floor(Math.random() * 4)] });
    }
    const fogPos = [[-170, 250], [-40, 330], [-230, 330], [10, 220], [-110, 160], [-260, 190]];
    fogPos.forEach(([x, y], i) => fogs.push({ x, y, s: rand(150, 230), sp: rand(5, 11) * (i % 2 ? 1 : -1), ph: rand(0, TAU), c: i % 3 }));
    for (let i = 0; i < 6; i++) clouds.push({ x: rand(-330, 330), y: rand(-390, -240), s: rand(150, 240), sp: rand(4, 9), c: i % 3 });
  }

  function poof(x, y, color) {
    const n = REDUCED ? 6 : 14;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, sp = rand(25, 85);
      smoke.push({ x: x + Math.cos(a) * 6, y: y + Math.sin(a) * 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.8 - 10, r: rand(16, 30), g: rand(40, 70), life: 0, max: rand(0.7, 1.25) });
    }
    const m = REDUCED ? 8 : 24;
    for (let i = 0; i < m; i++) {
      const a = Math.random() * TAU, sp = rand(60, 190);
      sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: rand(0.4, 0.9), color });
    }
    rings.push({ x, y, age: 0, dur: 0.75, max: 100, color });
  }
  function spawnBolt() {
    const z = ZONES.cloud;
    let x = 0, y = 0;
    for (let i = 0; i < 20; i++) {
      x = z.x + rand(-210, 210); y = z.y + rand(-70, 60);
      if (inCoast(x, y, 0.1) && Math.hypot(x - locations[1].wx, y - locations[1].wy) > 125) break;
    }
    const segs = [];
    const jag = (x0, y0, x1, y1, n, amp) => {
      let px = x0, py = y0;
      for (let i = 1; i <= n; i++) {
        const t = i / n, nx = lerp(x0, x1, t) + (i === n ? 0 : rand(-amp, amp)), ny = lerp(y0, y1, t);
        segs.push([px, py, nx, ny]); px = nx; py = ny;
      }
      return [px, py];
    };
    jag(x + rand(-8, 8), y - 120, x, y, 8, 12);
    jag(x, y - 70, x + rand(25, 45) * (Math.random() < 0.5 ? -1 : 1), y - 30, 4, 7);
    bolt = { x, y, segs, age: 0, dur: 0.34 };
    for (let i = 0; i < 12; i++) { const a = Math.random() * TAU, sp = rand(30, 110); sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, life: 0, max: rand(0.3, 0.7), color: '#BAE6FD' }); }
  }
  function spawnFlock() {
    const dir = Math.random() < 0.5 ? 1 : -1, n = 5 + Math.floor(Math.random() * 4);
    const y0 = rand(height * 0.28, height * 0.72), slope = rand(-0.22, 0.22);
    for (let i = 0; i < n; i++) {
      crows.push({ x: dir > 0 ? -60 - i * rand(26, 44) : width + 60 + i * rand(26, 44), yb: y0 + rand(-45, 45) + i * rand(-8, 8), ph: rand(0, TAU), sc: rand(0.85, 1.25), dir, sp: 150 + rand(-18, 18), slope });
    }
  }

  function updateAmbient(dt) {
    for (const l of leaves) {
      l.life += dt;
      if (l.life > l.max) Object.assign(l, spawnLeaf(false));
      l.x += (l.vx + Math.sin(time * 1.7 + l.sw) * 14) * dt;
      l.y += (l.vy + Math.cos(time * 2.1 + l.sw) * 10) * dt;
      l.rot += l.vr * dt;
    }
    for (const s of sandBits) { s.x -= s.v * dt; s.y += 6 * dt; if (s.x < 160 || s.y > 90) { s.x = rand(380, 410); s.y = rand(-250, 40); } }
    for (const m of motes) { m.y += m.vy * dt; m.x += Math.sin(time * 0.5 + m.ph) * 6 * dt; if (m.y < -580) { m.y = 580; m.x = rand(-820, 820); } }
    for (const f of fogs) { f.x += f.sp * dt; if (f.x > 120) f.sp = -Math.abs(f.sp); if (f.x < -330) f.sp = Math.abs(f.sp); }
    for (const c of clouds) { c.x += c.sp * dt; if (c.x > 420) c.x = -420; }
    for (let i = smoke.length - 1; i >= 0; i--) { const p = smoke[i]; p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - 1.6 * dt; p.vy *= 1 - 1.6 * dt; if (p.life >= p.max) smoke.splice(i, 1); }
    for (let i = sparks.length - 1; i >= 0; i--) { const p = sparks[i]; p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - 2.2 * dt; p.vy *= 1 - 2.2 * dt; if (p.life >= p.max) sparks.splice(i, 1); }
    for (let i = rings.length - 1; i >= 0; i--) { rings[i].age += dt; if (rings[i].age >= rings[i].dur) rings.splice(i, 1); }
    if (!REDUCED) {
      nextBolt -= dt;
      if (nextBolt <= 0) { nextBolt = 2.4 + Math.random() * 4.6; spawnBolt(); }
    }
    if (bolt) { bolt.age += dt; if (bolt.age > bolt.dur) bolt = null; }
    if (!REDUCED) { crowTimer -= dt; if (crowTimer <= 0) { crowTimer = 20 + Math.random() * 14; spawnFlock(); } }
    for (let i = crows.length - 1; i >= 0; i--) {
      const c = crows[i]; c.x += c.dir * c.sp * dt;
      if ((c.dir > 0 && c.x > width + 140) || (c.dir < 0 && c.x < -140)) crows.splice(i, 1);
    }
  }

  /* ════════════════════════════════════════════════════════════════════════
10. DRAW — WORLD LAYER
  ════════════════════════════════════════════════════════════════════════ */
  const introAlpha = () => (!CFG.intro || REDUCED ? 1 : easeOutCubic(clamp((introT - 0.15) / 1.3, 0, 1)));

  function drawSeigaiha() {
    if (!seigaiha) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.1 + Math.sin(time * 0.6) * 0.015;
    const ox = (-cam.x * baseScale * cam.z * 0.4 + time * 4) % 64, oy = (-cam.y * baseScale * cam.z * 0.4) % 32;
    ctx.translate(ox, oy);
    ctx.fillStyle = seigaiha;
    ctx.fillRect(-64, -32, width + 128, height + 64);
    ctx.restore();
  }
  function drawSeal(a) {
    ctx.save(); ctx.lineCap = 'round';
    const rot = time * 0.04;
    ctx.strokeStyle = `rgba(251,191,36,${0.09 * a})`; ctx.lineWidth = 1.6;
    ctx.setLineDash([46, 22]); ctx.lineDashOffset = -time * 3;
    ctx.beginPath(); ctx.arc(0, 0, 585, 0, TAU); ctx.stroke();
    ctx.setLineDash([4, 12]); ctx.strokeStyle = `rgba(34,211,238,${0.12 * a})`;
    ctx.beginPath(); ctx.arc(0, 0, 610, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = `rgba(251,191,36,${0.07 * a})`; ctx.lineWidth = 1;
    for (let i = 0; i < 48; i++) {
      const th = rot + (i / 48) * TAU, len = i % 4 === 0 ? 20 : 9;
      ctx.beginPath(); ctx.moveTo(Math.cos(th) * 560, Math.sin(th) * 560); ctx.lineTo(Math.cos(th) * (560 - len), Math.sin(th) * (560 - len)); ctx.stroke();
    }
    ctx.fillStyle = `rgba(251,191,36,${0.1 * a})`;
    for (let k = 0; k < 4; k++) { ctx.save(); ctx.rotate(k * Math.PI / 2 + rot * 2); ctx.translate(0, -585); shurikenPath(ctx, 17); ctx.fill(); ctx.restore(); }
    ctx.restore();
  }
  function drawWhirlpool(a) {
    const p = w2s(WHIRL.x, WHIRL.y), rs = WHIRL.r * baseScale * cam.z;
    if (p.x + rs < 0 || p.x - rs > width || p.y + rs < 0 || p.y - rs > height) return;
    ctx.save(); ctx.translate(WHIRL.x, WHIRL.y); ctx.globalAlpha = a; ctx.lineCap = 'round';
    const R0 = WHIRL.r, g = ctx.createRadialGradient(0, 0, 0, 0, 0, R0);
    g.addColorStop(0, 'rgba(2,8,16,0.95)'); g.addColorStop(0.35, 'rgba(6,30,48,0.7)'); g.addColorStop(1, 'rgba(10,60,90,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R0, 0, TAU); ctx.fill();
    const rot = time * 0.7;
    for (let arm = 0; arm < 5; arm++) {
      for (let band = 0; band < 3; band++) {
        ctx.beginPath();
        for (let i = 0; i <= 14; i++) {
          const u = lerp(band / 3, (band + 1) / 3, i / 14), th = rot + (arm * TAU) / 5 - u * 4.4, r = R0 * (0.06 + 0.94 * u);
          if (i === 0) ctx.moveTo(Math.cos(th) * r, Math.sin(th) * r); else ctx.lineTo(Math.cos(th) * r, Math.sin(th) * r);
        }
        ctx.strokeStyle = `rgba(150,235,250,${0.55 - band * 0.17})`; ctx.lineWidth = 3.4 - band * 0.9; ctx.stroke();
      }
    }
    ctx.fillStyle = 'rgba(120,225,245,0.45)'; ctx.font = `600 12px ${FONT_MONO}`; ctx.textAlign = 'center';
    ctx.fillText('~ Uzushio Whirlpool ~', 0, R0 + 18);
    ctx.restore();
  }
  function drawRipples(a) {
    ctx.save(); ctx.lineJoin = 'round';
    for (let i = 0; i < 5; i++) {
      const p = (time * 0.085 + i / 5) % 1, s = 1.015 + p * 0.2, al = Math.pow(1 - p, 1.7) * 0.3 * a;
      if (al < 0.01) continue;
      ctx.save(); ctx.scale(s, s);
      ctx.lineWidth = (2.2 + (1 - p) * 2) / s; ctx.strokeStyle = `rgba(110,225,245,${al})`;
      ctx.setLineDash(i % 2 ? [22 / s, 14 / s] : []); ctx.lineDashOffset = -time * 8;
      ctx.stroke(coast.path); ctx.restore();
    }
    ctx.restore();
  }
  function drawShips(a) {
    for (const s of SHIPS) {
      const sign = Math.sign(s.speed), ang = s.a + time * s.speed;
      const x = s.rx * Math.cos(ang), y = s.ry * Math.sin(ang);
      const hd = Math.atan2(s.ry * Math.cos(ang) * sign, -s.rx * Math.sin(ang) * sign);
      ctx.save(); ctx.globalAlpha = a; ctx.lineCap = 'round';
      for (let k = 1; k <= 14; k++) {
        const a2 = ang - k * 0.0048 * sign;
        ctx.strokeStyle = `rgba(210,245,255,${0.32 * (1 - k / 14)})`; ctx.lineWidth = 2.6 * (1 - k / 18);
        ctx.beginPath(); ctx.moveTo(s.rx * Math.cos(a2 + 0.0048 * sign), s.ry * Math.sin(a2 + 0.0048 * sign)); ctx.lineTo(s.rx * Math.cos(a2), s.ry * Math.sin(a2)); ctx.stroke();
      }
      ctx.translate(x, y); ctx.rotate(hd + Math.sin(time * 1.6 + s.ph) * 0.04);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(2, 3, 20, 6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3d2b1c'; ctx.beginPath();
      ctx.moveTo(19, 0); ctx.quadraticCurveTo(9, -6.5, -12, -5.5); ctx.lineTo(-15, 0); ctx.lineTo(-12, 5.5); ctx.quadraticCurveTo(9, 6.5, 19, 0); ctx.fill();
      ctx.strokeStyle = 'rgba(251,191,36,0.7)'; ctx.lineWidth = 0.9; ctx.stroke();
      ctx.fillStyle = 'rgba(238,228,205,0.95)'; ctx.beginPath(); ctx.ellipse(1.5, 0, 3.4, 9.5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#7c2d12'; ctx.beginPath(); ctx.arc(1.5, 0, 1.4, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter'; glow(glowSprite('#F97316'), -13, 0, 9, 0.7);
      ctx.restore();
    }
  }
  function drawTerrain(a) {
    ctx.save();
    const s = lerp(0.94, 1, a);
    ctx.scale(s, s); ctx.globalAlpha = a; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(terrain, -TERR_HALF, -TERR_HALF, TERR_HALF * 2, TERR_HALF * 2);
    ctx.restore();
  }
  function drawIslets(a) {
    ctx.save(); ctx.globalAlpha = a;
    for (const i of islets) {
      const bob = Math.sin(time * 0.8 + i.x) * 1.2;
      ctx.drawImage(i.cv, i.x - i.half, i.y - i.half + bob, i.half * 2, i.half * 2);
    }
    ctx.restore();
  }
  function drawWaterAnimations(a) {
    ctx.save(); ctx.globalAlpha = a; ctx.clip(coast.path); ctx.lineCap = 'round';
    for (const r of RIVERS) {
      ctx.setLineDash([2, 22]); ctx.lineDashOffset = -time * 18; ctx.strokeStyle = 'rgba(210,248,255,0.6)'; ctx.lineWidth = 2.6; ctx.stroke(r.path);
      ctx.setLineDash([1, 36]); ctx.lineDashOffset = -time * 28; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.8; ctx.stroke(r.path);
    }
    // waterfall streaks
    ctx.setLineDash([7, 11]); ctx.lineWidth = 2.4;
    [-6.5, -2, 2.5, 7].forEach((dx, i) => {
      ctx.lineDashOffset = -time * (70 + i * 9) + i * 5; ctx.strokeStyle = `rgba(255,255,255,${0.5 + (i % 2) * 0.2})`;
      ctx.beginPath(); ctx.moveTo(FALLS.x + dx, FALLS.y1); ctx.lineTo(FALLS.x + dx, FALLS.y2); ctx.stroke();
    });
    ctx.setLineDash([]);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const ph = (time * 0.7 + i / 7) % 1;
      glow(PUFF, FALLS.x + Math.sin(i * 2.1 + time) * 10, FALLS.y2 + 4 - ph * 22, 8 + ph * 12, (1 - ph) * 0.5);
    }
    ctx.restore();
  }
  function drawKanjiMarks(a) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const l of locations) {
      ctx.font = `700 190px ${FONT_JP}`;
      ctx.fillStyle = rgba(l.color, (0.085 + Math.sin(time * 0.7 + l.idx) * 0.02) * a);
      ctx.fillText(l.kanji, l.wx, l.wy + 4);
    }
    ctx.restore();
  }
  function drawVillageLights(a) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = glowSprite('#FBBF24');
    for (const l of lights) glow(g, l.x, l.y, 9, (0.5 + Math.sin(time * 5 + l.ph * 3) * 0.2 + Math.sin(time * 11 + l.ph) * 0.1) * a);
    ctx.restore();
  }
  function drawMist(a) {
    ctx.save();
    for (const f of fogs) { ctx.globalAlpha = 0.2 * a * (0.8 + Math.sin(time * 0.4 + f.ph) * 0.2); ctx.drawImage(CLOUDS[f.c], f.x - f.s / 2, f.y - f.s * 0.25 + Math.sin(time * 0.3 + f.ph) * 6, f.s, f.s * 0.5); }
    for (const c of clouds) {
      ctx.globalAlpha = 0.38 * a * clamp(1 - Math.abs(c.x) / 520, 0, 1) + 0.08 * a;
      ctx.drawImage(CLOUDS[c.c], c.x - c.s / 2, c.y - c.s * 0.25, c.s, c.s * 0.5);
    }
    // violet haze at the plunge pool
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35 * a; ctx.drawImage(glowSprite('#A855F7'), FALLS.x - 60, FALLS.y2 - 40, 120, 90);
    ctx.restore();
  }
  function drawRoutes(a) {
    const hl = hovered && hovered.loc;
    ctx.save(); ctx.globalAlpha = a; ctx.lineCap = 'round';
    routeGeo.forEach((r) => {
      const active = hl && (hl === r.a || hl === r.b);
      ctx.beginPath(); ctx.moveTo(r.a.wx, r.a.wy); ctx.quadraticCurveTo(r.cx, r.cy, r.b.wx, r.b.wy);
      ctx.setLineDash([5, 8]); ctx.lineDashOffset = -time * 12;
      ctx.lineWidth = active ? 2.4 : 1.6;
      ctx.strokeStyle = active ? rgba(hl.color, 0.85) : 'rgba(251,191,36,0.3)';
      ctx.stroke(); ctx.setLineDash([]);
    });
    ctx.globalCompositeOperation = 'lighter';
    const cy = glowSprite('#22D3EE'), wh = glowSprite('#E0F7FF');
    routeGeo.forEach((r) => {
      for (let k = 0; k < 2; k++) {
        const t0 = (time * (0.13 + (r.i % 3) * 0.015) + r.i * 0.17 + k * 0.5) % 1;
        for (let s = 0; s < 7; s++) {
          const t = t0 - s * 0.014; if (t < 0) continue;
          const u = 1 - t, x = u * u * r.a.wx + 2 * u * t * r.cx + t * t * r.b.wx, y = u * u * r.a.wy + 2 * u * t * r.cy + t * t * r.b.wy;
          glow(cy, x, y, 9 - s * 0.9, (1 - s / 7) * 0.9);
          if (s === 0) glow(wh, x, y, 3.6, 1);
        }
      }
    });
    ctx.restore();
  }
  function drawLeaves(a) {
    ctx.save();
    for (const l of leaves) {
      const al = Math.min(1, l.life / 1.5, (l.max - l.life) / 2) * 0.9 * a;
      if (al <= 0.01) continue;
      ctx.globalAlpha = al;
      ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.rot); ctx.scale(1, 0.35 + 0.65 * Math.abs(Math.cos(time * 3 + l.sw)));
      ctx.fillStyle = l.autumn ? '#f97316' : '#4ade80';
      ctx.beginPath(); ctx.moveTo(-l.size, 0); ctx.quadraticCurveTo(0, -l.size * 0.62, l.size, 0); ctx.quadraticCurveTo(0, l.size * 0.62, -l.size, 0); ctx.fill();
      ctx.strokeStyle = 'rgba(0,40,10,0.5)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(-l.size, 0); ctx.lineTo(l.size * 0.8, 0); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
  function drawFireflies(a) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = glowSprite('#D9F99D'), core = glowSprite('#FFFFFF');
    for (const f of fireflies) {
      const x = f.ox + Math.sin(time * f.sp + f.ph) * 20, y = f.oy + Math.cos(time * f.sp * 0.8 + f.ph * 1.3) * 15;
      const p = 0.5 + 0.5 * Math.sin(time * 1.9 + f.ph * 4);
      glow(g, x, y, 8, (0.15 + p * 0.7) * a); glow(core, x, y, 1.8, p * a);
    }
    ctx.restore();
  }
  function drawSand(a) {
    ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = 1.4;
    for (const s of sandBits) {
      ctx.strokeStyle = `rgba(255,228,172,${s.a * a})`;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + s.len, s.y - s.len * 0.07); ctx.stroke();
    }
    ctx.restore();
  }
  function drawLightning(a) {
    if (!bolt) return;
    const t = bolt.age / bolt.dur, fl = (t < 0.5 ? 1 : 0.55 + 0.45 * Math.sin(bolt.age * 90)) * (1 - t) * a;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    glow(glowSprite('#9CC8FF'), bolt.x, bolt.y, 110, fl * 0.85);
    ctx.strokeStyle = `rgba(140,190,255,${0.5 * fl})`; ctx.lineWidth = 8;
    ctx.beginPath(); bolt.segs.forEach(([x0, y0, x1, y1]) => { ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); }); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${fl})`; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.restore();
  }
  function drawMotes(a) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const m of motes) glow(glowSprite(m.c), m.x, m.y, m.r * 4.5, (0.25 + 0.55 * (0.5 + 0.5 * Math.sin(time * 1.6 + m.ph))) * a * 0.8);
    ctx.restore();
  }
  function drawEffects() {
    ctx.save();
    for (const p of smoke) {
      const t = p.life / p.max, r = p.r + p.g * easeOutCubic(t);
      glow(PUFF, p.x, p.y, r, (1 - t) * Math.min(1, t / 0.08 + 0.2) * 0.75);
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const p of sparks) { const t = p.life / p.max; glow(glowSprite(p.color), p.x, p.y, 3 + 7 * (1 - t), 1 - t); }
    for (const r of rings) {
      const t = r.age / r.dur;
      ctx.strokeStyle = rgba(r.color, (1 - t) * 0.8); ctx.lineWidth = 3.2 * (1 - t) + 0.6;
      ctx.beginPath(); ctx.arc(r.x, r.y, 8 + (r.max - 8) * easeOutCubic(t), 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }

  /* ════════════════════════════════════════════════════════════════════════
11. DRAW — SCREEN LAYER (pins, crows, trail, HUD)
  ════════════════════════════════════════════════════════════════════════ */
  const appearOf = (l) => (!CFG.intro || REDUCED ? 1 : clamp((introT - l.appearAt) / 0.55, 0, 1));

  function drawPins() {
    const sb = pinBase(), fs = clamp(Math.min(width, height) * 0.0135, 10, 13.5);
    const order = locations.slice().sort((p, q) => p.wy - q.wy);
    for (const loc of order) {
      const ap = appearOf(loc);
      if (ap <= 0.001) continue;
      const p = w2s(loc.wx, loc.wy);
      if (p.x < -140 || p.x > width + 140 || p.y < -140 || p.y > height + 140) continue;
      const hv = loc.h, s = sb * (1 + 0.16 * hv) * Math.max(0.01, easeOutBack(ap));
      const cx = p.x, cy = p.y + Math.sin(time * 1.6 + loc.idx * 1.3) * 1.3;
      const pw = s * 2.5, ph = s * 1.7;
      ctx.save();
      ctx.globalAlpha = clamp(ap * 1.8, 0, 1);

      // aura
      ctx.globalCompositeOperation = 'lighter';
      glow(glowSprite(loc.color), cx, cy, s * 3.6 * (1 + Math.sin(time * 2.4 + loc.idx) * 0.08), 0.32 + 0.36 * hv);
      ctx.globalCompositeOperation = 'source-over';

      // rotating seal ring
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(time * 0.35 * (loc.idx % 2 ? 1 : -1));
      ctx.lineWidth = 1.4; ctx.strokeStyle = rgba(loc.color, 0.5 + 0.4 * hv); ctx.setLineDash([s * 0.5, s * 0.34]);
      ctx.beginPath(); ctx.arc(0, 0, s * 1.95, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.lineWidth = 0.8; ctx.strokeStyle = rgba(loc.color, 0.22 + 0.2 * hv);
      ctx.beginPath(); ctx.arc(0, 0, s * 1.74, 0, TAU); ctx.stroke();
      ctx.restore();
      if (hv > 0.03) {
        for (let k = 0; k < 3; k++) { const a = time * 2.4 + (k * TAU) / 3; drawTomoe(ctx, cx + Math.cos(a) * s * 1.95, cy + Math.sin(a) * s * 1.95, s * 0.17, a + Math.PI / 2, rgba(loc.color, hv)); }
        const pp = (time * 1.1) % 1;
        ctx.strokeStyle = rgba(loc.color, (1 - pp) * 0.5 * hv); ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(cx, cy, s * (1.95 + 1.3 * pp), 0, TAU); ctx.stroke();
      }

      // headband cloth + fluttering tails
      const bw = pw / 2 + s * 1.15, bh = ph * 0.58;
      for (let k = 0; k < 2; k++) {
        const sway = Math.sin(time * 2.6 + k * 1.4 + loc.idx) * 0.28;
        ctx.save(); ctx.translate(cx + bw - 3, cy + 1); ctx.rotate(0.85 + k * 0.55 + sway);
        ctx.fillStyle = '#122648'; ctx.beginPath();
        ctx.moveTo(0, -bh * 0.22); ctx.quadraticCurveTo(s * 0.8, -bh * 0.3, s * 1.5, -bh * 0.05 + sway * s * 0.4);
        ctx.lineTo(s * 1.38, bh * 0.2); ctx.quadraticCurveTo(s * 0.7, bh * 0.16, 0, bh * 0.22); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      const bg = ctx.createLinearGradient(0, cy - bh / 2, 0, cy + bh / 2);
      bg.addColorStop(0, '#2d5190'); bg.addColorStop(0.5, '#1b3868'); bg.addColorStop(1, '#10234a');
      ctx.fillStyle = bg; ctx.fillRect(cx - bw, cy - bh / 2, bw * 2, bh);
      ctx.fillStyle = rgba(loc.color, 0.85); ctx.fillRect(cx - bw, cy - bh / 2, bw * 2, 1.4); ctx.fillRect(cx - bw, cy + bh / 2 - 1.4, bw * 2, 1.4);
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 0.8; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(cx - bw, cy - bh * 0.27); ctx.lineTo(cx + bw, cy - bh * 0.27); ctx.moveTo(cx - bw, cy + bh * 0.27); ctx.lineTo(cx + bw, cy + bh * 0.27); ctx.stroke(); ctx.setLineDash([]);

      // metal plate
      roundRectPath(ctx, cx - pw / 2, cy - ph / 2, pw, ph, s * 0.24);
      const pg = ctx.createLinearGradient(cx - pw / 2, cy - ph / 2, cx + pw * 0.3, cy + ph / 2);
      pg.addColorStop(0, '#f4f7fb'); pg.addColorStop(0.35, '#b8c5d4'); pg.addColorStop(0.7, '#8696a9'); pg.addColorStop(1, '#566475');
      ctx.fillStyle = pg; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#0b1220'; ctx.stroke();
      roundRectPath(ctx, cx - pw / 2 + 2.4, cy - ph / 2 + 2.4, pw - 4.8, ph - 4.8, s * 0.18);
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.stroke();
      roundRectPath(ctx, cx - pw / 2 - 1, cy - ph / 2 - 1, pw + 2, ph + 2, s * 0.26);
      ctx.lineWidth = 1.2; ctx.strokeStyle = rgba(loc.color, 0.55 + 0.4 * hv); ctx.stroke();
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([dx, dy]) => {
        const rx = cx + dx * (pw / 2 - s * 0.3), ry = cy + dy * (ph / 2 - s * 0.26);
        ctx.fillStyle = '#2b3544'; ctx.beginPath(); ctx.arc(rx, ry, s * 0.095, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(rx - s * 0.03, ry - s * 0.03, s * 0.03, 0, TAU); ctx.fill();
      });

      // engraved symbol
      const sz = ph * 0.36;
      drawSymbol(ctx, loc.symbol, cx + 0.8, cy + 1, sz, 'rgba(255,255,255,0.6)', 'rgba(255,255,255,0)');
      drawSymbol(ctx, loc.symbol, cx, cy, sz, '#222c3a', '#a9b8c8');
      if (hv > 0.02) {
        const ga = ctx.globalAlpha; ctx.globalAlpha = ga * hv;
        drawSymbol(ctx, loc.symbol, cx, cy, sz, loc.color, '#0f172a');
        ctx.globalAlpha = ga;
      }

      // floating village kanji
      ctx.save();
      ctx.font = `700 ${Math.round(s * 0.95)}px ${FONT_JP}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = loc.color; ctx.shadowBlur = 9 + 9 * hv;
      ctx.fillStyle = rgba(loc.color, 0.82 + 0.18 * hv);
      ctx.fillText(loc.kanji, cx, cy - s * 2.75 + Math.sin(time * 1.3 + loc.idx) * 1.5);
      ctx.restore();

      // nameplate
      ctx.font = `700 ${fs}px ${FONT_UI}`; const w1 = ctx.measureText(loc.label).width;
      ctx.font = `700 ${fs * 0.68}px ${FONT_MONO}`;
      if (hasLS) ctx.letterSpacing = '1px';
      const w2 = ctx.measureText(loc.tag).width;
      const boxW = Math.max(w1, w2) + 22, boxH = fs * 1.7 + 9, bx = cx - boxW / 2, by = cy + ph / 2 + s * 0.55;
      roundRectPath(ctx, bx + 1.5, by + 2.5, boxW, boxH, 5); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
      roundRectPath(ctx, bx, by, boxW, boxH, 5); ctx.fillStyle = 'rgba(7,10,20,0.93)'; ctx.fill();
      ctx.lineWidth = 1.2; ctx.strokeStyle = rgba(loc.color, 0.55 + 0.4 * hv); ctx.stroke();
      ctx.fillStyle = loc.color; ctx.fillRect(bx + 0.8, by + 5, 2.2, boxH - 10);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = rgba(loc.color, 0.95); ctx.fillText(loc.tag, cx + 1, by + boxH * 0.75);
      if (hasLS) ctx.letterSpacing = '0px';
      ctx.font = `700 ${fs}px ${FONT_UI}`; ctx.fillStyle = '#F8FAFC'; ctx.fillText(loc.label, cx + 1, by + boxH * 0.33);
      if (hv > 0.05) {
        ctx.font = `600 ${fs * 0.76}px ${FONT_MONO}`; ctx.fillStyle = `rgba(253,230,138,${hv})`;
        ctx.fillText('click to unroll scroll', cx, by + boxH + 11);
      }
      ctx.restore();
    }
  }

  function drawCrow(c, x, y, ang, sc, flap, col) {
    c.save(); c.translate(x, y); c.rotate(ang); c.scale(sc, sc); c.fillStyle = col;
    const span = 5 + 9 * Math.abs(Math.sin(flap)), sw = -4 - Math.sin(flap) * 3;
    c.beginPath(); c.moveTo(3, 0); c.quadraticCurveTo(0, -span * 0.6, sw - 3, -span); c.quadraticCurveTo(-3, -span * 0.35, -6, 0); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(3, 0); c.quadraticCurveTo(0, span * 0.6, sw - 3, span); c.quadraticCurveTo(-3, span * 0.35, -6, 0); c.closePath(); c.fill();
    c.beginPath(); c.ellipse(0, 0, 7, 2.6, 0, 0, TAU); c.fill();
    c.beginPath(); c.arc(7.5, 0, 2.2, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(9, -0.9); c.lineTo(12.5, 0.1); c.lineTo(9, 1); c.fill();
    c.beginPath(); c.moveTo(-6, -1.8); c.lineTo(-13, 0); c.lineTo(-6, 1.8); c.fill();
    c.restore();
  }
  function drawCrows() {
    if (!crows.length) return;
    ctx.save();
    for (const c of crows) {
      const y = c.yb + c.slope * (c.x - width / 2) + Math.sin(time * 0.9 + c.ph) * 14;
      const vy = c.slope * c.dir * c.sp + Math.cos(time * 0.9 + c.ph) * 12.6, ang = Math.atan2(vy, c.dir * c.sp);
      const fl = time * 11 + c.ph;
      drawCrow(ctx, c.x + 34, y + 58, ang, c.sc * 0.9, fl, 'rgba(0,0,0,0.22)');
      drawCrow(ctx, c.x, y, ang, c.sc, fl, 'rgba(4,6,12,0.95)');
    }
    ctx.restore();
  }

  const trail = [];
  function drawTrail() {
    if (trail.length < 2) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1], b = trail[i], t = 1 - Math.min(1, (time - b.t) / 0.5);
      if (t <= 0) continue;
      ctx.strokeStyle = `rgba(${i % 2 ? '34,211,238' : '251,191,36'},${t * 0.5})`; ctx.lineWidth = 1 + t * 3;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.restore();
  }

  function drawTitle(a) {
    const size = clamp(width * 0.017, 14, 22), y = Math.max(68, height * 0.105);
    ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = `700 ${size}px ${FONT_UI}`;
    const tw = ctx.measureText(TITLE).width;
    const g = ctx.createLinearGradient(width / 2 - tw / 2, 0, width / 2 + tw / 2, 0);
    g.addColorStop(0, '#fde68a'); g.addColorStop(0.5, '#fbbf24'); g.addColorStop(1, '#fb923c');
    ctx.shadowColor = 'rgba(249,115,22,0.5)'; ctx.shadowBlur = 14; ctx.fillStyle = g; ctx.fillText(TITLE, width / 2, y); ctx.shadowBlur = 0;
    const gap = 16, len = clamp(width * 0.06, 28, 110);
    [-1, 1].forEach((s) => {
      const x0 = width / 2 + s * (tw / 2 + gap), x1 = x0 + s * len, yy = y - size * 0.32;
      const lg = ctx.createLinearGradient(x0, 0, x1, 0); lg.addColorStop(0, 'rgba(251,191,36,0.75)'); lg.addColorStop(1, 'rgba(251,191,36,0)');
      ctx.strokeStyle = lg; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke();
      ctx.fillStyle = 'rgba(249,115,22,0.9)'; ctx.beginPath(); ctx.moveTo(x0 - s * 6, yy); ctx.lineTo(x0, yy - 3.4); ctx.lineTo(x0 + s * 3, yy); ctx.lineTo(x0, yy + 3.4); ctx.closePath(); ctx.fill();
    });
    ctx.font = `600 ${size * 0.62}px ${FONT_JP}`; ctx.fillStyle = 'rgba(251,191,36,0.6)';
    ctx.fillText('忍 界 大 陸', width / 2, y + size * 1.2);
    ctx.restore();
  }
  function drawCompass(a) {
    if (isPortrait || width < 700) return;
    const cx = Math.max(60, width * 0.055), cy = Math.max(135, height * 0.185), cr = clamp(width * 0.02, 18, 26);
    ctx.save(); ctx.globalAlpha = a; ctx.translate(cx, cy);
    ctx.strokeStyle = 'rgba(251,191,36,0.5)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, cr, 0, TAU); ctx.stroke();
    ctx.setLineDash([2, 5]); ctx.strokeStyle = 'rgba(34,211,238,0.4)'; ctx.beginPath(); ctx.arc(0, 0, cr + 6, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(251,191,36,0.45)';
    for (let i = 0; i < 12; i++) { const th = (i / 12) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(th) * cr, Math.sin(th) * cr); ctx.lineTo(Math.cos(th) * (cr - (i % 3 ? 3 : 6)), Math.sin(th) * (cr - (i % 3 ? 3 : 6))); ctx.stroke(); }
    ctx.save(); ctx.rotate(time * 0.5);
    shurikenPath(ctx, cr * 0.82);
    const g = ctx.createLinearGradient(-cr, -cr, cr, cr); g.addColorStop(0, '#fdba74'); g.addColorStop(1, '#ea580c');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#0b1220'; ctx.beginPath(); ctx.arc(0, 0, cr * 0.16, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#FBBF24'; ctx.beginPath(); ctx.moveTo(0, -cr - 9); ctx.lineTo(4, -cr - 3); ctx.lineTo(-4, -cr - 3); ctx.closePath(); ctx.fill();
    ctx.font = `700 10px ${FONT_MONO}`; ctx.textAlign = 'center'; ctx.fillText('N', 0, -cr - 13);
    ctx.restore();
  }
  function drawLegend(a) {
    if (width < 520) return;
    const rowH = 15, padTop = 26, padBot = 8;
    const lw = 238, lh = padTop + locations.length * rowH + padBot;
    const lx = 18, ly = height - lh - 22;

    ctx.save();
    ctx.globalAlpha = a;
    roundRectPath(ctx, lx, ly, lw, lh, 6);
    ctx.fillStyle = 'rgba(8,12,22,0.88)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(251,191,36,0.35)';
    ctx.stroke();

    ctx.fillStyle = '#F97316';
    ctx.fillRect(lx, ly + 4, 2.5, lh - 8);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `700 9.5px ${FONT_MONO}`;
    ctx.fillStyle = '#FBBF24';
    ctx.fillText('LOCATION GUIDE', lx + 11, ly + 14);

    locations.forEach((loc, i) => {
      const y = ly + padTop + i * rowH;
      const active = hovered && hovered.loc === loc;

      if (active) {
        roundRectPath(ctx, lx + 6, y - 6.5, lw - 12, 13, 3);
        ctx.fillStyle = rgba(loc.color, 0.14);
        ctx.fill();
      }

      ctx.fillStyle = loc.color;
      ctx.beginPath();
      ctx.arc(lx + 15, y, active ? 3.6 : 2.8, 0, TAU);
      ctx.fill();

      ctx.font = `700 9px ${FONT_MONO}`;
      ctx.fillStyle = active ? '#FFFFFF' : '#F8FAFC';
      ctx.fillText(loc.label, lx + 24, y);

      ctx.font = `8.5px ${FONT_MONO}`;
      ctx.fillStyle = active ? '#E2E8F0' : '#94A3B8';
      ctx.fillText(`— ${loc.guide}`, lx + 114, y);
    });

    ctx.restore();
  }

  /* ════════════════════════════════════════════════════════════════════════
12. FRAME
  ════════════════════════════════════════════════════════════════════════ */
  const routeGeo = routes.map(([from, to], i) => {
    const a = locById(from), b = locById(to);
    const dx = b.wx - a.wx, dy = b.wy - a.wy, len = Math.hypot(dx, dy), side = (i % 2 ? 1 : -1) * len * 0.13;
    return { a, b, i, cx: (a.wx + b.wx) / 2 - (dy / len) * side, cy: (a.wy + b.wy) / 2 + (dx / len) * side };
  });

  function render() {
    const ta = introAlpha();
    setScreenTransform();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(bgCanvas, 0, 0, width, height);
    drawSeigaiha();

    setWorldTransform();
    drawSeal(ta);
    drawWhirlpool(ta);
    drawRipples(ta);
    drawIslets(ta);
    drawShips(ta);
    drawTerrain(ta);
    drawWaterAnimations(ta);
    drawKanjiMarks(ta);
    drawVillageLights(ta);
    drawMist(ta);
    drawRoutes(ta);
    drawSand(ta);
    drawLeaves(ta);
    drawFireflies(ta);
    drawLightning(ta);
    drawMotes(ta);
    drawEffects();

    setScreenTransform();
    drawPins();
    drawCrows();
    drawTrail();
    const hudA = CFG.intro && !REDUCED ? clamp((introT - 0.5) / 1.0, 0, 1) : 1;
    drawTitle(hudA); drawCompass(hudA); drawLegend(hudA);
    ctx.globalAlpha = 1;
    ctx.drawImage(vignetteCanvas, 0, 0, width, height);
    if (bolt) { const t = bolt.age / bolt.dur; ctx.fillStyle = `rgba(150,190,255,${0.05 * (1 - t) * (t < 0.5 ? 1 : 0.5)})`; ctx.fillRect(0, 0, width, height); }
    if (CFG.intro && !REDUCED && introT < 0.9) { ctx.fillStyle = `rgba(2,4,10,${1 - introT / 0.9})`; ctx.fillRect(0, 0, width, height); }
  }

  function update(dt) {
    time += dt;
    if (introT < INTRO_TOTAL) introT += dt;
    for (const l of locations) {
      if (!l.popped && introT >= l.appearAt) { l.popped = true; poof(l.wx, l.wy, l.color); }
    }

    // inertia + camera
    if (!pointers.size && (Math.abs(vel.x) > 1 || Math.abs(vel.y) > 1)) {
      tgt.x += vel.x * dt; tgt.y += vel.y * dt;
      const d = Math.exp(-dt * 4.5); vel.x *= d; vel.y *= d;
    }
    tgt.z = clamp(tgt.z, CFG.minZoom, CFG.maxZoom);
    tgt.x = clamp(tgt.x, -900, 900); tgt.y = clamp(tgt.y, -650, 650);
    const introGlide = CFG.intro && !REDUCED && introT < 2.8 && !flying;
    const k = 1 - Math.exp(-dt * (flying ? 5.2 : introGlide ? 2.1 : 11));
    cam.x += (tgt.x - cam.x) * k; cam.y += (tgt.y - cam.y) * k;
    cam.z *= Math.pow(tgt.z / cam.z, k);

    if (arrive) {
      const S = baseScale * cam.z, dpx = Math.hypot((cam.x - tgt.x) * S, (cam.y - tgt.y) * S), dz = Math.abs(Math.log(cam.z / tgt.z)), el = time - arrive.t0;
      if ((dpx < 4 && dz < 0.02 && el > 0.3) || el > 1.8) {
        const a = arrive; arrive = null; flying = false;
        poof(a.loc.wx, a.loc.wy, a.loc.color);
        if (typeof a.cb === 'function') a.cb(a.loc);
      }
    }

    if (mouse.inside && !dragMoved) {
      hovered = hitTest(mouse.x, mouse.y);
      canvas.style.cursor = hovered ? 'pointer' : 'grab';
    } else if (dragMoved) { hovered = null; canvas.style.cursor = 'grabbing'; }
    for (const l of locations) {
      const target = hovered && hovered.loc === l ? (hovered.kind === 'pin' ? 1 : 0.55) : 0;
      l.h += (target - l.h) * (1 - Math.exp(-dt * 12));
    }
    while (trail.length && time - trail[0].t > 0.5) trail.shift();
    updateAmbient(dt);
  }

  let last = 0;
  function frame(now) {
    if (!last) last = now;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    update(dt); render();
    requestAnimationFrame(frame);
  }

  /* ════════════════════════════════════════════════════════════════════════
13. INPUT
  ════════════════════════════════════════════════════════════════════════ */
  const REGION_R = 125;
  const pointers = new Map();
  let dragMoved = false, downPos = null, lastMove = null, pinch0 = null;

  function hitTest(sx, sy) {
    const r = pinBase() * 2.1;
    let best = null, bd = 1e9;
    for (const l of locations) {
      if (appearOf(l) < 0.6) continue;
      const p = w2s(l.wx, l.wy), d = Math.hypot(sx - p.x, sy - p.y);
      if (d < r && d < bd) { best = l; bd = d; }
    }
    if (best) return { loc: best, kind: 'pin' };
    const w = s2w(sx, sy);
    bd = 1e9;
    for (const l of locations) {
      if (appearOf(l) < 0.6) continue;
      const d = Math.hypot(w.x - l.wx, w.y - l.wy);
      if (d < REGION_R && d < bd) { best = l; bd = d; }
    }
    return best ? { loc: best, kind: 'region' } : null;
  }
  function pos(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function zoomAt(sx, sy, nz) {
    nz = clamp(nz, CFG.minZoom, CFG.maxZoom);
    const w = s2w(sx, sy, tgt);
    tgt.z = nz;
    tgt.x = w.x - (sx - vcx) / (baseScale * nz);
    tgt.y = w.y - (sy - vcy) / (baseScale * nz);
  }
  function activate(loc) {
    poof(loc.wx, loc.wy, loc.color);
    setTimeout(() => { if (typeof window.openLocationScroll === 'function') window.openLocationScroll(loc.id); }, CFG.clickDelay);
  }

  canvas.style.touchAction = 'none';
  canvas.style.cursor = 'grab';
  canvas.addEventListener('pointerdown', (e) => {
    const p = pos(e);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    pointers.set(e.pointerId, p);
    mouse.x = p.x; mouse.y = p.y; mouse.inside = true;
    vel.x = vel.y = 0;
    if (pointers.size === 1) { downPos = p; lastMove = { x: p.x, y: p.y, t: performance.now() }; dragMoved = false; }
    else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y), z: tgt.z }; dragMoved = true;
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = pos(e);
    mouse.x = p.x; mouse.y = p.y; mouse.inside = true;
    if (e.pointerType === 'mouse') trail.push({ x: p.x, y: p.y, t: time });
    if (trail.length > 28) trail.shift();
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, p);
    if (pointers.size === 2 && pinch0) {
      const [a, b] = [...pointers.values()];
      zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, pinch0.z * (Math.hypot(a.x - b.x, a.y - b.y) / pinch0.d));
      return;
    }
    if (pointers.size === 1 && downPos) {
      if (!dragMoved && Math.hypot(p.x - downPos.x, p.y - downPos.y) > 6) { dragMoved = true; flying = false; arrive = null; }
      if (dragMoved) {
        const S = baseScale * tgt.z, now = performance.now(), dtm = Math.max(1, now - lastMove.t) / 1000;
        const dx = (p.x - lastMove.x) / S, dy = (p.y - lastMove.y) / S;
        tgt.x -= dx; tgt.y -= dy;
        vel.x = lerp(vel.x, -dx / dtm, 0.5); vel.y = lerp(vel.y, -dy / dtm, 0.5);
        lastMove = { x: p.x, y: p.y, t: now };
      }
    }
  });
  function endPointer(e, isUp) {
    const p = pos(e), had = pointers.has(e.pointerId);
    pointers.delete(e.pointerId);
    if (!had) return;
    if (pointers.size === 0) {
      if (!dragMoved && isUp) { const hit = hitTest(p.x, p.y); if (hit) activate(hit.loc); }
      else { vel.x = clamp(vel.x, -900, 900); vel.y = clamp(vel.y, -900, 900); }
      dragMoved = false; downPos = null; pinch0 = null;
    } else if (pointers.size === 1) { pinch0 = null; vel.x = vel.y = 0; downPos = null; }
  }
  canvas.addEventListener('pointerup', (e) => endPointer(e, true));
  canvas.addEventListener('pointercancel', (e) => endPointer(e, false));
  canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !pointers.size) { mouse.inside = false; hovered = null; } });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const p = pos(e), k = e.deltaMode === 1 ? 0.05 : 0.0016;
    flying = false;
    zoomAt(p.x, p.y, tgt.z * Math.exp(-e.deltaY * k));
  }, { passive: false });

  /* ════════════════════════════════════════════════════════════════════════
14. PUBLIC API + BOOT
  ════════════════════════════════════════════════════════════════════════ */
  window.ShinobiMap = {
    focusLocation(id, onArrived) {
      const loc = locById(id);
      if (!loc) return;
      tgt.x = loc.wx; tgt.y = loc.wy + 10; tgt.z = CFG.focusZoom + (isPortrait ? 0.2 : 0);
      vel.x = vel.y = 0; flying = true; hovered = null;
      arrive = { loc, cb: onArrived, t0: time };
    },
    resetView() {
      hovered = null; arrive = null; flying = true;
      vel.x = vel.y = 0;
      tgt.x = home.x; tgt.y = home.y; tgt.z = home.z;
    },
    replayIntro() {
      introT = 0; locations.forEach((l) => { l.popped = false; });
      cam.z = home.z * 1.35; tgt.x = home.x; tgt.y = home.y; tgt.z = home.z; flying = false; arrive = null;
    }
  };

  let resizeTimer = null;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth; height = window.innerHeight;
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    layout();
    buildScreenLayers();
    ctx.imageSmoothingEnabled = true;
  }
  function onResize() {
    resize();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (Math.abs(wantTerrainR() / terrainR - 1) > 0.2) buildTerrain(); }, 200);
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);

  buildCoast();
  initAmbient();
  resize();
  buildTerrain();
  cam.x = tgt.x = home.x; cam.y = tgt.y = home.y; cam.z = tgt.z = home.z;
  if (!CFG.intro || REDUCED) { introT = 99; locations.forEach((l) => { l.popped = true; }); }
  else { cam.z = home.z * 1.35; }
  requestAnimationFrame(frame);
})();