S
// js/map.js - The Shinobi Continent: a living, animated, Naruto-themed canvas map
(() => {
    const canvas = document.getElementById('worldMapCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
 
    // ---------- DATA (same ids / API as before) ----------
    const locations = [
        { id: 'about',     label: 'Leaf Outpost',  tag: 'HIDDEN LEAF',   vx: -0.04, vy: -0.02, color: '#F97316', icon: '🏯' },
        { id: 'education', label: 'Wits Academy',  tag: 'HIDDEN CLOUD',  vx: -0.02, vy: -0.28, color: '#FBBF24', icon: '🎓' },
        { id: 'skills',    label: 'Chakra Dojo',   tag: 'STONE PEAKS',   vx: -0.27, vy: -0.10, color: '#22D3EE', icon: '🌀' },
        { id: 'awards',    label: 'Hall of Fame',  tag: 'VALLEY OF END', vx:  0.26, vy:  0.19, color: '#A855F7', icon: '📜' },
        { id: 'projects',  label: 'Mission Board', tag: 'HIDDEN SAND',   vx:  0.22, vy: -0.06, color: '#F97316', icon: '🎯' },
        { id: 'contact',   label: 'Summon Shrine', tag: 'HIDDEN MIST',   vx: -0.09, vy:  0.25, color: '#22D3EE', icon: '🦅' }
    ];
    const routes = [
        ['about', 'education'], ['about', 'skills'], ['about', 'projects'],
        ['about', 'contact'], ['about', 'awards'], ['contact', 'awards']
    ];
    const COAST = [
        [-0.41, -0.20], [-0.34, -0.35], [-0.16, -0.42], [0.06, -0.41], [0.26, -0.35],
        [0.41, -0.22], [0.43, -0.03], [0.41, 0.19], [0.33, 0.34], [0.16, 0.41],
        [-0.07, 0.42], [-0.24, 0.37], [-0.39, 0.26], [-0.44, 0.07], [-0.45, -0.08]
    ];
 
    // ---------- HELPERS ----------
    const TAU = Math.PI * 2;
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
    const hexA = (hex, a) => hex + Math.round(clamp(a, 0, 1) * 255).toString(16).padStart(2, '0');
    const mulberry = (seed) => () => {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
 
    // ---------- STATE ----------
    let width = 0, height = 0, dpr = 1, isPortrait = false;
    let hoveredLoc = null, time = 0, introT = 0, lastTs = 0;
    const pan = { x: 0, y: 0, tx: 0, ty: 0 };
    let drag = null;
    const layer = document.createElement('canvas');   // cached static scenery
    const lctx = layer.getContext('2d');
    let landPath = null, riverPath = null, sandBox = null;
    let stars = [], akClouds = [], leaves = [], embers = [], flies = [], sand = [], fogs = [], storm = [];
    const puffs = [];
    let shuriken = null, nextShuriken = 6, bolt = null, nextBolt = 3, shoot = null, nextShoot = 4;
 
    // ---------- GEOMETRY ----------
    function getMapMetrics() {
        const usableW = width * (isPortrait ? 0.96 : 0.92);
        const usableH = height * (isPortrait ? 0.72 : 0.84);
        const mapDim = Math.max(260, Math.min(usableW, usableH));
        const centerY = height * (isPortrait ? 0.51 : 0.54);
        return { mapDim, centerX: width * 0.5, centerY };
    }
    function vBase(vx, vy) {
        const { mapDim, centerX, centerY } = getMapMetrics();
        return {
            x: centerX + vx * (isPortrait ? 1.12 : 1) * mapDim,
            y: centerY + vy * (isPortrait ? 0.92 : 1) * mapDim
        };
    }
    function vToScreen(vx, vy) { const b = vBase(vx, vy); return { x: b.x + pan.x, y: b.y + pan.y }; }
    const getLoc = (id) => locations.find((l) => l.id === id) || null;
 
    function smoothPath(pts) {
        const p = new Path2D(), n = pts.length;
        p.moveTo((pts[n - 1].x + pts[0].x) / 2, (pts[n - 1].y + pts[0].y) / 2);
        for (let i = 0; i < n; i++) {
            const c = pts[i], nx = pts[(i + 1) % n];
            p.quadraticCurveTo(c.x, c.y, (c.x + nx.x) / 2, (c.y + nx.y) / 2);
        }
        p.closePath();
        return p;
    }
    function openSmooth(pts) {
        const p = new Path2D();
        p.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
            p.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
        }
        p.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        return p;
    }
    function jaggedCoast() {
        const r = mulberry(11), out = [];
        COAST.forEach((a, i) => {
            const b = COAST[(i + 1) % COAST.length];
            out.push(a);
            [0.33, 0.66].forEach((t) => out.push([lerp(a[0], b[0], t) + (r() - 0.5) * 0.03, lerp(a[1], b[1], t) + (r() - 0.5) * 0.03]));
        });
        return out;
    }
 
    // ---------- STATIC LAYER (land, zones, Hokage cliff, forests, peaks...) ----------
    function buildLayer() {
        layer.width = Math.round(width * dpr);
        layer.height = Math.round(height * dpr);
        const c = lctx, B = vBase;
        const md = getMapMetrics().mapDim;
        const r = mulberry(5);
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.clearRect(0, 0, width, height);
        const toPts = (arr) => arr.map(([x, y]) => B(x, y));
        const ctr = B(0, 0);
 
        landPath = smoothPath(toPts(jaggedCoast()));
        riverPath = openSmooth(toPts([[-0.04, -0.45], [0.02, -0.22], [0.04, 0.02], [-0.04, 0.22], [0.02, 0.45]]));
 
        // shoreline glow
        [[30, 0.035], [20, 0.05], [11, 0.08]].forEach(([w, a]) => {
            c.lineWidth = w; c.strokeStyle = `rgba(34,211,238,${a})`; c.lineJoin = 'round'; c.stroke(landPath);
        });
        // land body
        const g = c.createRadialGradient(ctr.x, ctr.y, md * 0.04, ctr.x, ctr.y, md * 0.58);
        g.addColorStop(0, '#2c3d25'); g.addColorStop(0.55, '#1f2e1d'); g.addColorStop(1, '#1a2420');
        c.fillStyle = g; c.fill(landPath);
 
        c.save();
        c.clip(landPath);
        // biome zones
        const zone = (pts, col) => { c.fillStyle = col; c.fill(smoothPath(toPts(pts))); };
        zone([[-0.41, -0.20], [-0.34, -0.35], [-0.17, -0.41], [-0.15, -0.14], [-0.21, 0.14], [-0.38, 0.25], [-0.44, 0.04]], 'rgba(110,86,64,0.38)');
        zone([[0.14, -0.38], [0.26, -0.35], [0.41, -0.22], [0.42, 0.12], [0.22, 0.09], [0.13, -0.15]], 'rgba(206,150,66,0.30)');
        zone([[-0.17, -0.12], [0.11, -0.14], [0.14, 0.14], [-0.16, 0.16]], 'rgba(34,197,94,0.17)');
        // terrain speckle
        for (let i = 0; i < 700; i++) {
            const p = B(-0.46 + r() * 0.92, -0.43 + r() * 0.86);
            c.fillStyle = r() < 0.5 ? 'rgba(134,239,172,0.05)' : 'rgba(251,191,36,0.05)';
            c.fillRect(p.x, p.y, 1 + r() * 2, 1 + r() * 2);
        }
        // dunes
        c.strokeStyle = 'rgba(253,224,71,0.2)'; c.lineWidth = 1.2;
        for (let i = 0; i < 18; i++) {
            const p = B(0.18 + r() * 0.24, -0.34 + r() * 0.4), w = md * (0.03 + r() * 0.04);
            c.beginPath(); c.moveTo(p.x - w, p.y);
            c.quadraticCurveTo(p.x, p.y - w * 0.5, p.x + w, p.y); c.stroke();
        }
        // Konoha leaf swirl under the village
        const lv = B(-0.04, -0.02), R = md * 0.085;
        c.strokeStyle = 'rgba(249,115,22,0.22)'; c.lineWidth = 4; c.lineCap = 'round';
        c.beginPath();
        for (let k = 0; k <= 60; k++) {
            const t = k / 60, a = t * Math.PI * 3.2 - 0.6, rr = t * R;
            k ? c.lineTo(lv.x + Math.cos(a) * rr, lv.y + Math.sin(a) * rr) : c.moveTo(lv.x, lv.y);
        }
        c.stroke();
        c.beginPath(); c.moveTo(lv.x, lv.y); c.lineTo(lv.x + R * 1.25, lv.y + R * 0.75); c.stroke();
        // inner rim shadow
        c.lineWidth = 40; c.strokeStyle = 'rgba(0,0,0,0.28)'; c.stroke(landPath);
 
        // forest canopy
        for (let i = 0; i < 70; i++) {
            const x = -0.16 + r() * 0.28, y = -0.06 + r() * 0.2;
            if (((x + 0.02) / 0.15) ** 2 + ((y - 0.04) / 0.11) ** 2 > 1) continue;
            const p = B(x, y), tr = clamp(md * 0.011, 5, 9) * (0.8 + r() * 0.5);
            c.fillStyle = 'rgba(21,128,61,0.55)'; c.beginPath(); c.arc(p.x, p.y, tr, 0, TAU); c.fill();
            c.fillStyle = 'rgba(134,239,172,0.28)'; c.beginPath(); c.arc(p.x - tr * 0.3, p.y - tr * 0.3, tr * 0.5, 0, TAU); c.fill();
        }
        // river
        c.lineCap = 'round';
        c.lineWidth = 8; c.strokeStyle = 'rgba(8,47,73,0.55)'; c.stroke(riverPath);
        c.lineWidth = 4.2; c.strokeStyle = 'rgba(34,211,238,0.6)'; c.stroke(riverPath);
 
        // snowy peaks
        const mtnSz = clamp(md * 0.024, 9, 19);
        [[-0.32, -0.24], [-0.36, -0.14], [-0.28, -0.17], [-0.34, -0.02], [-0.30, 0.10], [-0.38, -0.30], [-0.24, -0.06],
         [-0.10, -0.36], [-0.02, -0.38], [0.08, -0.34], [0.22, -0.30], [0.31, -0.22], [0.36, -0.30]].forEach(([vx, vy]) => {
            const p = B(vx, vy), s = mtnSz * (0.85 + ((vx * 97 + vy * 53) % 0.3 + 0.3));
            c.beginPath(); c.moveTo(p.x, p.y - s); c.lineTo(p.x + s * 0.9, p.y + s * 0.7); c.lineTo(p.x - s * 0.9, p.y + s * 0.7); c.closePath();
            c.fillStyle = '#3b3f4a'; c.fill();
            c.beginPath(); c.moveTo(p.x, p.y - s); c.lineTo(p.x + s * 0.9, p.y + s * 0.7); c.lineTo(p.x + s * 0.1, p.y + s * 0.7); c.closePath();
            c.fillStyle = 'rgba(0,0,0,0.35)'; c.fill();
            c.beginPath(); c.moveTo(p.x, p.y - s); c.lineTo(p.x + s * 0.3, p.y - s * 0.42); c.lineTo(p.x - s * 0.3, p.y - s * 0.42); c.closePath();
            c.fillStyle = 'rgba(241,245,249,0.85)'; c.fill();
        });
 
        // HOKAGE MONUMENT: five carved faces above the village
        {
            const base = B(-0.08, -0.10), w = md * 0.21, h = md * 0.1;
            c.beginPath();
            c.moveTo(base.x - w / 2, base.y);
            c.lineTo(base.x - w / 2 + 6, base.y - h * 0.55);
            c.quadraticCurveTo(base.x - w * 0.3, base.y - h * 1.15, base.x, base.y - h * 1.05);
            c.quadraticCurveTo(base.x + w * 0.3, base.y - h * 1.15, base.x + w / 2 - 6, base.y - h * 0.55);
            c.lineTo(base.x + w / 2, base.y); c.closePath();
            const rg = c.createLinearGradient(0, base.y - h, 0, base.y);
            rg.addColorStop(0, '#6b6355'); rg.addColorStop(1, '#2d2a24');
            c.fillStyle = rg; c.fill();
            c.strokeStyle = 'rgba(251,191,36,0.5)'; c.lineWidth = 1.2; c.stroke();
            const hr = w * 0.075;
            for (let i = 0; i < 5; i++) {
                const hx = base.x - w * 0.36 + i * w * 0.18, hy = base.y - h * 0.62;
                c.fillStyle = '#c9b48f'; c.beginPath(); c.arc(hx, hy, hr, 0, TAU); c.fill();
                c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.arc(hx, hy, hr, -Math.PI / 2, Math.PI / 2); c.fill();
                c.fillStyle = '#4a3b2a'; c.beginPath(); c.arc(hx, hy - hr * 0.1, hr, Math.PI, TAU); c.fill();
                c.fillStyle = '#2a2118'; c.fillRect(hx - hr * 0.55, hy - hr * 0.05, hr * 0.38, 1.4); c.fillRect(hx + hr * 0.17, hy - hr * 0.05, hr * 0.38, 1.4);
                c.fillStyle = '#c9b48f'; c.fillRect(hx - hr * 0.7, hy + hr * 0.95, hr * 1.4, hr * 0.9);
            }
        }
 
        // VALLEY OF THE END: two statues flanking the waterfall
        [[0.205, -1], [0.315, 1]].forEach(([vx, dir]) => {
            const p = B(vx, 0.15), w = md * 0.045;
            c.fillStyle = '#3a3733'; c.fillRect(p.x - w / 2, p.y - md * 0.05, w, md * 0.1);
            c.fillStyle = '#5a554d';
            c.beginPath(); c.moveTo(p.x - w * 0.45, p.y - md * 0.05); c.lineTo(p.x + w * 0.45, p.y - md * 0.05);
            c.lineTo(p.x + w * 0.3 * dir, p.y - md * 0.085); c.lineTo(p.x - w * 0.3 * dir, p.y - md * 0.085); c.closePath(); c.fill();
            c.beginPath(); c.arc(p.x + w * 0.08 * dir * -1, p.y - md * 0.1, w * 0.22, 0, TAU); c.fill();
            c.strokeStyle = 'rgba(168,85,247,0.55)'; c.lineWidth = 1; c.strokeRect(p.x - w / 2, p.y - md * 0.05, w, md * 0.1);
        });
        c.restore();
 
        // inked coastline
        c.lineJoin = 'round';
        c.lineWidth = 3; c.strokeStyle = 'rgba(251,191,36,0.65)'; c.stroke(landPath);
        c.lineWidth = 1; c.strokeStyle = 'rgba(255,237,170,0.5)'; c.stroke(landPath);
    }
 
    // ---------- SCENERY INIT ----------
    function newEmber(r, scatter) {
        const l = locations[Math.floor(r() * locations.length)], b = vBase(l.vx, l.vy);
        const max = 2 + r() * 3;
        return { x: b.x + (r() - 0.5) * 60, y: b.y + (r() - 0.5) * 30, vy: 14 + r() * 22, life: scatter ? r() * max : 0, max, col: r() < 0.5 ? '#22D3EE' : '#F97316', s: 1 + r() * 1.8, ph: r() * TAU };
    }
    function initScenery() {
        const r = mulberry(42), md = getMapMetrics().mapDim;
        stars = Array.from({ length: Math.round(width * height / 9000) }, () => ({ x: r() * width, y: r() * height, r: 0.4 + r() * 1.2, o: 0.3 + r() * 0.7, sp: 0.8 + r() * 2.5, ph: r() * TAU, z: r() * 0.12 }));
        akClouds = [0, 1, 2].map((i) => ({ x: r() * width, y: height * (0.14 + i * 0.3) + r() * 40, s: 16 + r() * 12, v: 5 + r() * 6 }));
        leaves = Array.from({ length: 30 }, () => ({ x: r() * width, y: r() * height, vx: 25 + r() * 35, vy: 6 + r() * 12, rot: r() * TAU, vr: (r() - 0.5) * 4, s: 4 + r() * 4, ph: r() * TAU, c: r() < 0.7 ? '#4ade80' : '#fb923c' }));
        const er = mulberry(9);
        embers = Array.from({ length: 50 }, () => newEmber(er, true));
        flies = Array.from({ length: 16 }, () => ({ ph: r() * TAU, sp: 0.4 + r() * 0.6, rx: md * (0.05 + r() * 0.1), ry: md * (0.04 + r() * 0.08) }));
        const sa = vBase(0.16, -0.34), sb = vBase(0.42, 0.08);
        sandBox = { ax: sa.x, bx: sb.x };
        sand = Array.from({ length: 36 }, () => ({ x: sa.x + r() * (sb.x - sa.x), y: sa.y + r() * (sb.y - sa.y), v: 30 + r() * 40, l: 6 + r() * 10 }));
        const fc = vBase(-0.09, 0.30);
        fogs = Array.from({ length: 6 }, () => ({ x: fc.x + (r() - 0.5) * md * 0.3, y: fc.y + (r() - 0.5) * md * 0.12, r: md * (0.08 + r() * 0.07), ph: r() * TAU, sp: 0.15 + r() * 0.2 }));
        const sc = vBase(-0.02, -0.36);
        storm = Array.from({ length: 4 }, (_, i) => ({ x: sc.x + (i - 1.5) * md * 0.08, y: sc.y + (r() - 0.5) * 16, s: md * (0.03 + r() * 0.02), ph: r() * TAU }));
    }
 
    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = window.innerWidth; height = window.innerHeight;
        isPortrait = height > width * 1.05;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        buildLayer();
        initScenery();
    }
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
 
    // ---------- INTERACTION ----------
    function findLocationAtScreen(sx, sy) {
        const hitRadius = Math.max(26, Math.min(44, Math.min(width, height) * 0.055));
        for (const loc of locations) {
            const p = vToScreen(loc.vx, loc.vy);
            if (Math.hypot(sx - p.x, sy - p.y) <= hitRadius) return loc;
        }
        return null;
    }
    function spawnPuff(bx, by, col) { puffs.push({ x: bx, y: by, t: 0, col, seed: Math.random() * TAU }); }
    function activate(loc) {
        const p = vToScreen(loc.vx, loc.vy);
        spawnPuff(p.x - pan.x, p.y - pan.y, loc.color);
        setTimeout(() => { if (typeof window.openLocationScroll === 'function') window.openLocationScroll(loc.id); }, 260);
    }
 
    window.ShinobiMap = {
        focusLocation(id, onArrived) {
            const loc = getLoc(id);
            if (!loc) return;
            const b = vBase(loc.vx, loc.vy), m = getMapMetrics();
            pan.tx = clamp((m.centerX - b.x) * 0.35, -width * 0.1, width * 0.1);
            pan.ty = clamp((m.centerY - b.y) * 0.35, -height * 0.08, height * 0.08);
            if (typeof onArrived === 'function') setTimeout(() => onArrived(loc), 450);
        },
        resetView() { hoveredLoc = null; pan.tx = 0; pan.ty = 0; }
    };
 
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', (e) => {
        drag = { sx: e.clientX, sy: e.clientY, px: pan.tx, py: pan.ty, moved: false, id: e.pointerId };
        if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
        if (drag && e.pointerId === drag.id) {
            const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
            if (Math.hypot(dx, dy) > 6) drag.moved = true;
            if (drag.moved) {
                pan.tx = clamp(drag.px + dx, -width * 0.1, width * 0.1);
                pan.ty = clamp(drag.py + dy, -height * 0.08, height * 0.08);
                canvas.style.cursor = 'grabbing';
                hoveredLoc = null;
                return;
            }
        }
        hoveredLoc = findLocationAtScreen(e.clientX, e.clientY);
        canvas.style.cursor = hoveredLoc ? 'pointer' : 'grab';
    });
    canvas.addEventListener('pointerup', (e) => {
        if (drag && !drag.moved) { const hit = findLocationAtScreen(e.clientX, e.clientY); if (hit) activate(hit); }
        drag = null;
        if (e.pointerType !== 'mouse') hoveredLoc = null;
        canvas.style.cursor = hoveredLoc ? 'pointer' : 'grab';
    });
    canvas.addEventListener('pointerleave', () => { hoveredLoc = null; });
    canvas.style.cursor = 'grab';
 
    // ---------- DRAWING: SEA & SKY ----------
    function akCloud(x, y, s) {
        const parts = [[0, 0, 1], [0.9, 0.15, 0.8], [-0.9, 0.2, 0.75], [0.4, -0.5, 0.7], [-0.4, -0.45, 0.65]];
        ctx.strokeStyle = '#dc2626'; ctx.lineWidth = 2.4;
        parts.forEach(([dx, dy, k]) => { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, k * s * 0.62, 0, TAU); ctx.stroke(); });
        ctx.fillStyle = '#07090f';
        parts.forEach(([dx, dy, k]) => { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, k * s * 0.62, 0, TAU); ctx.fill(); });
    }
 
    function drawSea(dt) {
        const g = ctx.createRadialGradient(width / 2, height / 2, 40, width / 2, height / 2, Math.max(width, height) * 0.78);
        g.addColorStop(0, '#14233d'); g.addColorStop(0.6, '#0B1320'); g.addColorStop(1, '#04060d');
        ctx.fillStyle = g; ctx.fillRect(0, 0, width, height);
 
        // twinkling stars (parallax)
        ctx.fillStyle = '#e0f2fe';
        stars.forEach((s) => {
            ctx.globalAlpha = s.o * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * s.sp + s.ph)));
            ctx.beginPath(); ctx.arc(s.x + pan.x * s.z, s.y + pan.y * s.z, s.r, 0, TAU); ctx.fill();
        });
        ctx.globalAlpha = 1;
 
        // shooting star
        nextShoot -= dt;
        if (nextShoot < 0 && !shoot) { shoot = { x: Math.random() * width * 0.6, y: Math.random() * height * 0.25, t: 0 }; nextShoot = 6 + Math.random() * 8; }
        if (shoot) {
            shoot.t += dt;
            const k = shoot.t / 0.8, x = shoot.x + k * 260, y = shoot.y + k * 120;
            const sg = ctx.createLinearGradient(x - 70, y - 32, x, y);
            sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(1, `rgba(255,255,255,${0.9 * (1 - k)})`);
            ctx.strokeStyle = sg; ctx.lineWidth = 1.6;
            ctx.beginPath(); ctx.moveTo(x - 70, y - 32); ctx.lineTo(x, y); ctx.stroke();
            if (k >= 1) shoot = null;
        }
 
        // Rinnegan moon
        const mx = width * 0.87 + pan.x * 0.05, my = height * 0.2 + pan.y * 0.05, mr = clamp(Math.min(width, height) * 0.07, 28, 72);
        const halo = ctx.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 3.2);
        halo.addColorStop(0, 'rgba(196,181,253,0.28)'); halo.addColorStop(1, 'rgba(196,181,253,0)');
        ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(mx, my, mr * 3.2, 0, TAU); ctx.fill();
        const mg = ctx.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mx, my, mr);
        mg.addColorStop(0, '#f8fafc'); mg.addColorStop(1, '#c4b5fd');
        ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(109,40,217,0.22)'; ctx.lineWidth = 1.4;
        for (let i = 1; i <= 5; i++) { ctx.beginPath(); ctx.arc(mx, my, mr * i / 5.2, 0, TAU); ctx.stroke(); }
        ctx.strokeStyle = `rgba(167,139,250,${0.12 + 0.08 * Math.sin(time * 1.5)})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(mx, my, mr * (1.25 + 0.1 * Math.sin(time * 1.5)), 0, TAU); ctx.stroke();
 
        // faint grid
        const step = clamp(Math.min(width, height) * 0.08, 44, 76);
        ctx.strokeStyle = 'rgba(34,211,238,0.035)'; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x < width; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
        for (let y = 0; y < height; y += step) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
        ctx.stroke();
 
        // drifting Akatsuki clouds
        ctx.globalAlpha = 0.55;
        akClouds.forEach((c) => {
            c.x += c.v * dt; if (c.x > width + 120) c.x = -120;
            akCloud(c.x + pan.x * 0.3, c.y + Math.sin(time * 0.3 + c.s) * 6, c.s);
        });
        ctx.globalAlpha = 1;
 
        // sea waves + caption
        for (let k = 0; k < 3; k++) {
            const wy = height * (0.9 + k * 0.025);
            ctx.beginPath();
            for (let x = 0; x <= width; x += 20) {
                const y = wy + Math.sin(x * 0.02 + time * (1.5 + k * 0.4) + k) * 3.5;
                x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            }
            ctx.strokeStyle = `rgba(34,211,238,${0.14 - k * 0.04})`; ctx.lineWidth = 1.4; ctx.stroke();
        }
        ctx.font = '600 11px monospace'; ctx.fillStyle = 'rgba(34,211,238,0.35)'; ctx.textAlign = 'center';
        ctx.fillText('~ Sea of Mist ~', width / 2, height * 0.965);
 
        // pulsing shore ripples (under the land)
        ctx.save(); ctx.translate(pan.x, pan.y);
        for (let k = 0; k < 3; k++) {
            const ph = (time * 0.22 + k / 3) % 1;
            ctx.lineWidth = 10 + ph * 70; ctx.strokeStyle = `rgba(34,211,238,${0.11 * (1 - ph)})`;
            ctx.stroke(landPath);
        }
        ctx.restore();
    }
 
    // ---------- DRAWING: LIVING LAND OVERLAYS ----------
    function drawLand(dt) {
        const landA = clamp(introT / 1.1, 0, 1);
        ctx.save();
        ctx.globalAlpha = landA; ctx.translate(pan.x, pan.y);
        ctx.drawImage(layer, 0, 0, width, height);
        ctx.restore();
 
        ctx.save();
        ctx.globalAlpha = landA; ctx.translate(pan.x, pan.y);
        const md = getMapMetrics().mapDim;
 
        ctx.save(); ctx.clip(landPath);
        // glowing river current
        ctx.setLineDash([10, 22]); ctx.lineDashOffset = -time * 30;
        ctx.strokeStyle = 'rgba(207,250,254,0.6)'; ctx.lineWidth = 1.6; ctx.stroke(riverPath);
        ctx.setLineDash([]);
        // waterfall at the Valley of the End
        const wt = vBase(0.26, 0.095), wb = vBase(0.26, 0.17);
        ctx.setLineDash([7, 9]); ctx.lineWidth = 1.6;
        for (let i = -3; i <= 3; i++) {
            ctx.lineDashOffset = -time * (70 + i * 6);
            ctx.strokeStyle = `rgba(224,242,254,${0.7 - Math.abs(i) * 0.1})`;
            ctx.beginPath(); ctx.moveTo(wt.x + i * md * 0.006, wt.y); ctx.lineTo(wb.x + i * md * 0.007, wb.y); ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.fillStyle = `rgba(186,230,253,${0.25 + 0.1 * Math.sin(time * 3)})`;
        ctx.beginPath(); ctx.ellipse(wb.x, wb.y, md * 0.04, md * 0.012, 0, 0, TAU); ctx.fill();
        // sand storm
        ctx.strokeStyle = 'rgba(253,224,71,0.3)'; ctx.lineWidth = 1;
        sand.forEach((s) => {
            s.x += s.v * dt; if (s.x > sandBox.bx) s.x = sandBox.ax;
            ctx.beginPath(); ctx.moveTo(s.x, s.y + Math.sin(time + s.v) * 3); ctx.lineTo(s.x - s.l, s.y + Math.sin(time + s.v) * 3); ctx.stroke();
        });
        // Hidden Mist fog
        fogs.forEach((f) => {
            const fx = f.x + Math.sin(time * f.sp + f.ph) * md * 0.05;
            const fg = ctx.createRadialGradient(fx, f.y, 0, fx, f.y, f.r);
            fg.addColorStop(0, 'rgba(186,230,253,0.14)'); fg.addColorStop(1, 'rgba(186,230,253,0)');
            ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(fx, f.y, f.r, 0, TAU); ctx.fill();
        });
        ctx.restore(); // end land clip
 
        // village lanterns (flicker)
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 9; i++) {
            const a = i / 9 * TAU, p = vBase(-0.04, -0.02), rr = md * 0.075;
            const x = p.x + Math.cos(a) * rr, y = p.y + Math.sin(a) * rr * 0.75;
            const f = 0.55 + 0.45 * Math.sin(time * 5 + i * 1.7);
            const lg = ctx.createRadialGradient(x, y, 0, x, y, 12);
            lg.addColorStop(0, `rgba(251,146,60,${0.8 * f})`); lg.addColorStop(1, 'rgba(251,146,60,0)');
            ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(x, y, 12, 0, TAU); ctx.fill();
        }
        // fireflies in the forest
        const fc = vBase(-0.02, 0.04);
        flies.forEach((f) => {
            const x = fc.x + Math.cos(time * f.sp + f.ph) * f.rx, y = fc.y + Math.sin(time * f.sp * 1.3 + f.ph) * f.ry;
            const a = 0.3 + 0.7 * Math.max(0, Math.sin(time * 2.2 + f.ph * 3));
            const fg = ctx.createRadialGradient(x, y, 0, x, y, 7);
            fg.addColorStop(0, `rgba(253,224,71,${a})`); fg.addColorStop(1, 'rgba(253,224,71,0)');
            ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill();
        });
        // rising chakra embers
        embers.forEach((e, i) => {
            e.life += dt; e.y -= e.vy * dt;
            if (e.life > e.max) embers[i] = newEmber(Math.random, false);
            const a = Math.sin(clamp(e.life / e.max, 0, 1) * Math.PI);
            ctx.fillStyle = hexA(e.col, a * 0.85);
            ctx.beginPath(); ctx.arc(e.x + Math.sin(time * 2 + e.ph) * 5, e.y, e.s, 0, TAU); ctx.fill();
        });
        ctx.globalCompositeOperation = 'source-over';
 
        // Hidden Cloud storm clouds + lightning
        storm.forEach((s) => {
            const x = s.x + Math.sin(time * 0.3 + s.ph) * 12;
            ctx.fillStyle = 'rgba(203,213,225,0.16)';
            [[0, 0, 1], [0.8, 0.1, 0.8], [-0.8, 0.15, 0.7]].forEach(([dx, dy, k]) => { ctx.beginPath(); ctx.arc(x + dx * s.s, s.y + dy * s.s, k * s.s * 0.7, 0, TAU); ctx.fill(); });
        });
        nextBolt -= dt;
        if (nextBolt < 0 && !bolt) {
            const o = vBase(-0.02, -0.36), pts = [];
            let x = o.x + (Math.random() - 0.5) * md * 0.14, y = o.y;
            const endY = vBase(0, -0.27).y;
            for (let i = 0; i < 8; i++) { pts.push([x, y]); x += (Math.random() - 0.5) * 18; y += (endY - o.y) / 7; }
            bolt = { pts, life: 0.3 }; nextBolt = 4 + Math.random() * 6;
        }
        if (bolt) {
            bolt.life -= dt;
            const a = clamp(bolt.life / 0.3, 0, 1);
            ctx.lineJoin = 'round';
            [[7, `rgba(96,165,250,${0.3 * a})`], [1.8, `rgba(255,255,255,${a})`]].forEach(([w, col]) => {
                ctx.lineWidth = w; ctx.strokeStyle = col; ctx.beginPath();
                bolt.pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke();
            });
            if (bolt.life <= 0) bolt = null;
        }
        ctx.restore();
    }
 
    // ---------- DRAWING: ROUTES, PINS, FX ----------
    function quadPt(p1, c, p2, t) {
        const u = 1 - t;
        return { x: u * u * p1.x + 2 * u * t * c.x + t * t * p2.x, y: u * u * p1.y + 2 * u * t * c.y + t * t * p2.y };
    }
    function drawRoutes() {
        const a0 = clamp((introT - 0.5) / 1.2, 0, 1);
        if (a0 <= 0) return;
        ctx.globalAlpha = a0;
        routes.forEach(([fromId, toId], idx) => {
            const a = getLoc(fromId), b = getLoc(toId);
            if (!a || !b) return;
            const p1 = vToScreen(a.vx, a.vy), p2 = vToScreen(b.vx, b.vy);
            const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2, len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            const bend = len * 0.12 * (idx % 2 ? 1 : -1);
            const c = { x: mx - (p2.y - p1.y) / len * bend, y: my + (p2.x - p1.x) / len * bend };
            ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.quadraticCurveTo(c.x, c.y, p2.x, p2.y);
            ctx.setLineDash([6, 7]); ctx.lineDashOffset = -time * 12;
            ctx.strokeStyle = 'rgba(251,191,36,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.setLineDash([]);
            // chakra comet with trail
            const t0 = ((time * 0.17 + idx * 0.19) % 1 + 1) % 1;
            ctx.globalCompositeOperation = 'lighter';
            for (let k = 0; k < 9; k++) {
                const q = quadPt(p1, c, p2, clamp(t0 - k * 0.012, 0, 1)), f = 1 - k / 9;
                ctx.fillStyle = `rgba(34,211,238,${0.9 * f})`;
                ctx.beginPath(); ctx.arc(q.x, q.y, 1 + 3.2 * f, 0, TAU); ctx.fill();
            }
            ctx.globalCompositeOperation = 'source-over';
        });
        ctx.globalAlpha = 1;
    }
 
    function spiral(R, turns, rot) {
        ctx.beginPath();
        for (let k = 0; k <= 40; k++) {
            const t = k / 40, ang = rot + t * turns * TAU, rr = t * R;
            k ? ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr) : ctx.moveTo(0, 0);
        }
        ctx.stroke();
    }
 
    function drawPin(loc, i, dt) {
        const a = clamp((introT - 0.7 - i * 0.15) / 0.55, 0, 1);
        if (a <= 0) return;
        const p = vToScreen(loc.vx, loc.vy);
        if (!loc._born) { loc._born = true; spawnPuff(p.x - pan.x, p.y - pan.y, loc.color); }
        const hv = loc._h || 0;
        const baseR = clamp(Math.min(width, height) * 0.025, 14, 22);
        const r = baseR * easeOutBack(a) * (1 + hv * 0.2);
        const pulse = 1 + Math.sin(time * 3 + loc.vx * 10) * 0.1;
 
        const g = ctx.createRadialGradient(p.x, p.y, r * 0.5, p.x, p.y, r * 2.8 * pulse);
        g.addColorStop(0, hexA(loc.color, 0.45 + hv * 0.3)); g.addColorStop(1, hexA(loc.color, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r * 2.8 * pulse, 0, TAU); ctx.fill();
 
        ctx.save(); ctx.translate(p.x, p.y);
        ctx.lineWidth = 1.6; ctx.strokeStyle = hexA(loc.color, 0.85);
        ctx.setLineDash([r * 0.45, r * 0.35]); ctx.lineDashOffset = -time * 18;
        ctx.beginPath(); ctx.arc(0, 0, r * 1.5, 0, TAU); ctx.stroke();
        ctx.setLineDash([3, 7]); ctx.lineDashOffset = time * 24;
        ctx.beginPath(); ctx.arc(0, 0, r * 1.85, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
 
        if (hv > 0.02) { // Rasengan swirl
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = `rgba(125,211,252,${0.7 * hv})`; ctx.lineWidth = 2;
            for (let k = 0; k < 3; k++) spiral(r * 2.3, 1.4, time * 6 + k * TAU / 3);
            ctx.globalCompositeOperation = 'source-over';
        }
 
        ctx.fillStyle = 'rgba(11,16,30,0.95)';
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
        ctx.lineWidth = 2 + hv * 1.5; ctx.strokeStyle = loc.color; ctx.stroke();
 
        if (hv > 0.02) { // Sharingan tomoe orbit
            ctx.strokeStyle = `rgba(239,68,68,${hv})`; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.arc(0, 0, r * 1.18, 0, TAU); ctx.stroke();
            for (let k = 0; k < 3; k++) {
                const ang = time * 2.4 + k * TAU / 3, x = Math.cos(ang) * r * 1.18, y = Math.sin(ang) * r * 1.18;
                ctx.fillStyle = `rgba(239,68,68,${hv})`; ctx.beginPath(); ctx.arc(x, y, r * 0.15, 0, TAU); ctx.fill();
                ctx.strokeStyle = `rgba(239,68,68,${hv})`; ctx.lineWidth = r * 0.11; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.sin(ang) * r * 0.38, y + Math.cos(ang) * r * 0.38); ctx.stroke();
            }
        }
        ctx.restore();
 
        ctx.font = `${Math.round(r * 0.72)}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
        ctx.fillText(loc.icon, p.x, p.y + 1);
 
        // label scroll
        const fs = clamp(Math.round(baseR * 0.56), 9.5, 12);
        ctx.font = `700 ${fs}px "Space Grotesk", sans-serif`;
        const tw = ctx.measureText(loc.label).width + 14, ph = fs + 7, py = p.y + r + 5;
        ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(7,10,18,0.92)'; ctx.fillRect(p.x - tw / 2, py, tw, ph);
        ctx.strokeStyle = hexA(loc.color, 0.7 + hv * 0.3); ctx.lineWidth = 1; ctx.strokeRect(p.x - tw / 2, py, tw, ph);
        ctx.fillStyle = loc.color; ctx.fillRect(p.x - tw / 2, py, 3, ph);
        ctx.fillStyle = '#F8FAFC'; ctx.fillText(loc.label, p.x + 1.5, py + ph / 2 + 0.5);
        // village tag on hover
        if (hv > 0.02) {
            ctx.font = '700 10px monospace'; ctx.fillStyle = hexA(loc.color, hv);
            ctx.fillText(loc.tag, p.x, p.y - r * 2.1 - hv * 4);
        }
        ctx.globalAlpha = 1; ctx.textBaseline = 'alphabetic';
    }
 
    function drawLeaf(l) {
        ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.rot);
        ctx.fillStyle = l.c; ctx.globalAlpha = 0.75;
        ctx.beginPath(); ctx.moveTo(-l.s, 0); ctx.quadraticCurveTo(0, -l.s * 0.65, l.s, 0); ctx.quadraticCurveTo(0, l.s * 0.65, -l.s, 0); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(-l.s, 0); ctx.lineTo(l.s, 0); ctx.stroke();
        ctx.restore(); ctx.globalAlpha = 1;
    }
 
    function drawStar4(x, y, s, rot) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
            const a = i * Math.PI / 2;
            ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
            ctx.lineTo(Math.cos(a + Math.PI / 4) * s * 0.28, Math.sin(a + Math.PI / 4) * s * 0.28);
        }
        ctx.closePath(); ctx.fillStyle = '#cbd5e1'; ctx.fill();
        ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.arc(0, 0, s * 0.14, 0, TAU); ctx.fill();
        ctx.restore();
    }
 
    function drawFX(dt) {
        // leaves on the wind
        leaves.forEach((l) => {
            l.x += (l.vx + Math.sin(time + l.ph) * 10) * dt;
            l.y += (l.vy + Math.sin(time * 1.5 + l.ph) * 14) * dt;
            l.rot += l.vr * dt;
            if (l.x > width + 20) { l.x = -20; l.y = Math.random() * height; }
            if (l.y > height + 20) l.y = -20;
            drawLeaf(l);
        });
        // flying shuriken
        nextShuriken -= dt;
        if (nextShuriken < 0 && !shuriken) { shuriken = { x: -30, y: height * (0.15 + Math.random() * 0.6), vy: (Math.random() - 0.5) * 80 }; nextShuriken = 9 + Math.random() * 6; }
        if (shuriken) {
            shuriken.x += 520 * dt; shuriken.y += shuriken.vy * dt;
            const tg = ctx.createLinearGradient(shuriken.x - 120, 0, shuriken.x, 0);
            tg.addColorStop(0, 'rgba(203,213,225,0)'); tg.addColorStop(1, 'rgba(203,213,225,0.5)');
            ctx.strokeStyle = tg; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(shuriken.x - 120, shuriken.y - shuriken.vy * 0.23); ctx.lineTo(shuriken.x, shuriken.y); ctx.stroke();
            drawStar4(shuriken.x, shuriken.y, 11, time * 22);
            if (shuriken.x > width + 40) shuriken = null;
        }
        // smoke poofs + shock rings
        ctx.save(); ctx.translate(pan.x, pan.y);
        for (let i = puffs.length - 1; i >= 0; i--) {
            const f = puffs[i]; f.t += dt;
            const k = f.t / 0.8;
            if (k >= 1) { puffs.splice(i, 1); continue; }
            const e = easeOut(k);
            for (let j = 0; j < 8; j++) {
                const ang = j * TAU / 8 + f.seed;
                ctx.fillStyle = `rgba(232,238,248,${0.8 * (1 - k)})`;
                ctx.beginPath(); ctx.arc(f.x + Math.cos(ang) * 34 * e, f.y + Math.sin(ang) * 26 * e - 8 * e, 8 + 16 * k, 0, TAU); ctx.fill();
            }
            ctx.strokeStyle = hexA(f.col, 0.7 * (1 - k)); ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(f.x, f.y, 20 + e * 90, 0, TAU); ctx.stroke();
        }
        ctx.restore();
        // lightning flash
        if (bolt) { ctx.fillStyle = `rgba(186,230,253,${0.05 * clamp(bolt.life / 0.3, 0, 1)})`; ctx.fillRect(0, 0, width, height); }
    }
 
    function drawHUD() {
        const ta = clamp(introT / 0.9, 0, 1);
        const ts = clamp(width * 0.017, 13, 21) * 1.15;
        ctx.save(); ctx.globalAlpha = ta; ctx.textAlign = 'center';
        ctx.font = `700 ${ts}px "Space Grotesk", sans-serif`;
        ctx.shadowColor = 'rgba(249,115,22,0.8)'; ctx.shadowBlur = 16;
        ctx.fillStyle = '#FBBF24';
        ctx.fillText('The Shinobi Continent', width / 2, Math.max(68, height * 0.105));
        ctx.shadowBlur = 0;
        ctx.font = '600 11px monospace'; ctx.fillStyle = 'rgba(249,115,22,0.85)';
        ctx.fillText('忍 \u00B7 SHINOBI WORLD \u00B7 忍', width / 2, Math.max(68, height * 0.105) + 18);
        ctx.restore();
 
        if (!isPortrait) { // sway compass
            const cx = Math.max(48, width * 0.055), cy = Math.max(125, height * 0.18), cr = clamp(width * 0.019, 16, 24);
            ctx.save(); ctx.globalAlpha = ta;
            ctx.strokeStyle = 'rgba(251,191,36,0.5)'; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.arc(cx, cy, cr, 0, TAU); ctx.stroke();
            ctx.beginPath(); ctx.arc(cx, cy, cr + 5, 0, TAU); ctx.setLineDash([2, 5]); ctx.stroke(); ctx.setLineDash([]);
            ctx.translate(cx, cy); ctx.rotate(Math.sin(time * 0.9) * 0.14);
            ctx.beginPath(); ctx.moveTo(0, -cr - 5); ctx.lineTo(4, -2); ctx.lineTo(0, cr + 5); ctx.lineTo(-4, -2); ctx.closePath();
            ctx.fillStyle = 'rgba(249,115,22,0.85)'; ctx.fill();
            ctx.rotate(-Math.sin(time * 0.9) * 0.14);
            ctx.font = '700 10px monospace'; ctx.fillStyle = '#FBBF24'; ctx.textAlign = 'center';
            ctx.fillText('N', 0, -cr - 10);
            ctx.restore();
        }
        if (width >= 520) { // legend
            const lx = 18, ly = height - 86, lw = 166, lh = 64;
            ctx.save(); ctx.globalAlpha = ta;
            ctx.fillStyle = 'rgba(8,12,22,0.85)'; ctx.fillRect(lx, ly, lw, lh);
            ctx.strokeStyle = 'rgba(251,191,36,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(lx, ly, lw, lh);
            ctx.fillStyle = '#F97316'; ctx.fillRect(lx, ly, 3, lh);
            ctx.textAlign = 'left'; ctx.font = '700 9.5px monospace'; ctx.fillStyle = '#FBBF24';
            ctx.fillText('TACTICAL LEGEND', lx + 12, ly + 15);
            ctx.font = '9px monospace'; ctx.fillStyle = '#CBD5E1'; ctx.fillText('--- Chakra Route', lx + 12, ly + 31);
            ctx.fillStyle = '#22D3EE'; ctx.fillText('\u25CF Active Pulse', lx + 12, ly + 46);
            ctx.fillStyle = '#F97316'; ctx.fillText('\u25CE Scroll Landmark', lx + 12, ly + 58);
            ctx.restore();
        }
        // vignette
        const vg = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.35, width / 2, height / 2, Math.max(width, height) * 0.75);
        vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
        ctx.fillStyle = vg; ctx.fillRect(0, 0, width, height);
    }
 
    // ---------- MAIN LOOP ----------
    function render(ts) {
        const dt = clamp((ts - lastTs) / 1000 || 0, 0, 0.05);
        lastTs = ts; time += dt; introT += dt;
        const k = 1 - Math.exp(-dt * 9), kh = 1 - Math.exp(-dt * 12);
        pan.x += (pan.tx - pan.x) * k; pan.y += (pan.ty - pan.y) * k;
        locations.forEach((l) => { l._h = lerp(l._h || 0, hoveredLoc === l ? 1 : 0, kh); });
 
        ctx.clearRect(0, 0, width, height);
        drawSea(dt);
        drawLand(dt);
        drawRoutes();
        locations.forEach((l, i) => drawPin(l, i, dt));
        drawFX(dt);
        drawHUD();
        requestAnimationFrame(render);
    }
 
    resize();
    requestAnimationFrame(render);
})();