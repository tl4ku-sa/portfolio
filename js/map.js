// js/map.js - Responsive Vector Shinobi Continent Map & Interactive Pins
(() => {
    const canvas = document.getElementById('worldMapCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Logical continent coordinates (-0.5 to +0.5)
    const locations = [
        { id: 'about',     label: 'Leaf Outpost',  tag: 'HIDDEN LEAF',   vx: -0.04, vy: -0.02, color: '#F97316', icon: '🏯' },
        { id: 'education', label: 'Wits Academy',  tag: 'HIDDEN CLOUD',  vx: -0.02, vy: -0.28, color: '#FBBF24', icon: '🎓' },
        { id: 'skills',    label: 'Chakra Dojo',   tag: 'STONE PEAKS',   vx: -0.27, vy: -0.10, color: '#22D3EE', icon: '🌀' },
        { id: 'awards',    label: 'Hall of Fame',  tag: 'VALLEY OF END', vx:  0.26, vy:  0.19, color: '#A855F7', icon: '📜' },
        { id: 'projects',  label: 'Mission Board', tag: 'HIDDEN SAND',   vx:  0.22, vy: -0.06, color: '#F97316', icon: '🎯' },
        { id: 'contact',   label: 'Summon Shrine', tag: 'HIDDEN MIST',   vx: -0.09, vy:  0.25, color: '#22D3EE', icon: '🦅' }
    ];

    const routes = [
        ['about', 'education'],
        ['about', 'skills'],
        ['about', 'projects'],
        ['about', 'contact'],
        ['about', 'awards'],
        ['contact', 'awards']
    ];

    let width = 0;
    let height = 0;
    let dpr = 1;
    let isPortrait = false;
    let hoveredLoc = null;
    let pulsePhase = 0;

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = window.innerWidth;
        height = window.innerHeight;
        isPortrait = height > width * 1.05;

        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    resize();

    function getMapMetrics() {
        const usableW = width * (isPortrait ? 0.96 : 0.92);
        const usableH = height * (isPortrait ? 0.72 : 0.84);
        const mapDim = Math.max(260, Math.min(usableW, usableH));
        const centerY = height * (isPortrait ? 0.51 : 0.54);
        return { mapDim, centerX: width * 0.5, centerY };
    }

    function vToScreen(vx, vy) {
        const { mapDim, centerX, centerY } = getMapMetrics();
        const xScale = isPortrait ? 1.12 : 1.0;
        const yScale = isPortrait ? 0.92 : 1.0;
        return {
            x: centerX + vx * xScale * mapDim,
            y: centerY + vy * yScale * mapDim
        };
    }

    function getLocationById(id) {
        return locations.find((l) => l.id === id) || null;
    }

    function findLocationAtScreen(sx, sy) {
        const hitRadius = Math.max(26, Math.min(44, Math.min(width, height) * 0.055));
        for (const loc of locations) {
            const p = vToScreen(loc.vx, loc.vy);
            if (Math.hypot(sx - p.x, sy - p.y) <= hitRadius) {
                return loc;
            }
        }
        return null;
    }

    window.ShinobiMap = {
        focusLocation(id, onArrived) {
            const loc = getLocationById(id);
            if (!loc) return;
            if (typeof onArrived === 'function') onArrived(loc);
        },
        resetView() {
            hoveredLoc = null;
        }
    };

    canvas.addEventListener('mousemove', (e) => {
        hoveredLoc = findLocationAtScreen(e.clientX, e.clientY);
        canvas.style.cursor = hoveredLoc ? 'pointer' : 'default';
    });

    canvas.addEventListener('click', (e) => {
        const hit = findLocationAtScreen(e.clientX, e.clientY);
        if (hit && typeof window.openLocationScroll === 'function') {
            window.openLocationScroll(hit.id);
        }
    });

    function traceSmoothClosedPath(points) {
        if (points.length < 3) return;
        ctx.beginPath();
        const firstMidX = (points[points.length - 1].x + points[0].x) / 2;
        const firstMidY = (points[points.length - 1].y + points[0].y) / 2;
        ctx.moveTo(firstMidX, firstMidY);

        for (let i = 0; i < points.length; i++) {
            const curr = points[i];
            const next = points[(i + 1) % points.length];
            const midX = (curr.x + next.x) / 2;
            const midY = (curr.y + next.y) / 2;
            ctx.quadraticCurveTo(curr.x, curr.y, midX, midY);
        }
        ctx.closePath();
    }

    function drawSea() {
        const bgGrad = ctx.createRadialGradient(
            width * 0.5,
            height * 0.5,
            40,
            width * 0.5,
            height * 0.5,
            Math.max(width, height) * 0.78
        );
        bgGrad.addColorStop(0, '#111D30');
        bgGrad.addColorStop(0.6, '#0B1320');
        bgGrad.addColorStop(1, '#050811');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        const step = Math.max(44, Math.min(76, Math.min(width, height) * 0.08));
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.04)';
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x += step) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y < height; y += step) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        const waveY = height * 0.91;
        ctx.beginPath();
        for (let x = 0; x <= width; x += 24) {
            const wy = waveY + Math.sin(x * 0.02 + pulsePhase * 2) * 3.5;
            if (x === 0) ctx.moveTo(x, wy);
            else ctx.lineTo(x, wy);
        }
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.12)';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        ctx.font = '600 11px monospace';
        ctx.fillStyle = 'rgba(34, 211, 238, 0.35)';
        ctx.textAlign = 'center';
        ctx.fillText('~ Sea of Mist ~', width * 0.5, height * 0.955);
    }

    function drawContinent() {
        const islandPts = [
            [-0.41, -0.20], [-0.34, -0.35], [-0.16, -0.42], [0.06, -0.41],
            [ 0.26, -0.35], [ 0.41, -0.22], [ 0.43, -0.03], [0.41,  0.19],
            [ 0.33,  0.34], [ 0.16,  0.41], [-0.07,  0.42], [-0.24, 0.37],
            [-0.39,  0.26], [-0.44,  0.07], [-0.45, -0.08]
        ].map(([vx, vy]) => vToScreen(vx, vy));

        // Outer shoreline glow
        traceSmoothClosedPath(islandPts);
        ctx.fillStyle = 'rgba(34, 211, 238, 0.07)';
        ctx.fill();
        ctx.lineWidth = 12;
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.11)';
        ctx.stroke();

        // Main landmass fill
        traceSmoothClosedPath(islandPts);
        const landGrad = ctx.createLinearGradient(0, height * 0.18, 0, height * 0.85);
        landGrad.addColorStop(0, '#202D22');
        landGrad.addColorStop(0.45, '#19251C');
        landGrad.addColorStop(0.75, '#252B1E');
        landGrad.addColorStop(1, '#1A2329');
        ctx.fillStyle = landGrad;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
        ctx.stroke();

        // Organic Stone Peaks zone (west)
        const stonePts = [
            [-0.41, -0.20], [-0.34, -0.35], [-0.17, -0.41],
            [-0.15, -0.14], [-0.21,  0.14], [-0.38,  0.25], [-0.44, 0.04]
        ].map(([vx, vy]) => vToScreen(vx, vy));
        traceSmoothClosedPath(stonePts);
        ctx.fillStyle = 'rgba(96, 68, 46, 0.28)';
        ctx.fill();

        // Organic Wind Desert zone (east)
        const sandPts = [
            [0.14, -0.38], [0.26, -0.35], [0.41, -0.22],
            [0.42,  0.12], [0.22,  0.09], [0.13, -0.15]
        ].map(([vx, vy]) => vToScreen(vx, vy));
        traceSmoothClosedPath(sandPts);
        ctx.fillStyle = 'rgba(186, 134, 62, 0.22)';
        ctx.fill();

        // Organic Forest / Fire Lowlands zone (center)
        const forestPts = [
            [-0.17, -0.16], [0.11, -0.18], [0.14, 0.14], [-0.16, 0.16]
        ].map(([vx, vy]) => vToScreen(vx, vy));
        traceSmoothClosedPath(forestPts);
        ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
        ctx.fill();
    }

    function drawFeatures() {
        const riverPts = [
            [-0.04, -0.39], [0.02, -0.22], [0.04, 0.02], [-0.04, 0.22], [0.02, 0.41]
        ].map(([vx, vy]) => vToScreen(vx, vy));

        ctx.beginPath();
        riverPts.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.52)';
        ctx.lineWidth = 2.8;
        ctx.stroke();

        const mtns = [
            [-0.32, -0.24], [-0.36, -0.14], [-0.28, -0.17], [-0.34, -0.02], [-0.30, 0.10],
            [-0.10, -0.34], [-0.02, -0.35], [ 0.08, -0.32], [ 0.22, -0.29], [ 0.31, -0.21]
        ];
        const mtnSz = Math.max(7, Math.min(13, Math.min(width, height) * 0.015));
        mtns.forEach(([vx, vy]) => {
            const p = vToScreen(vx, vy);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y - mtnSz);
            ctx.lineTo(p.x + mtnSz * 0.85, p.y + mtnSz * 0.7);
            ctx.lineTo(p.x - mtnSz * 0.85, p.y + mtnSz * 0.7);
            ctx.closePath();
            ctx.fillStyle = 'rgba(148, 163, 184, 0.22)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(253, 224, 71, 0.38)';
            ctx.lineWidth = 1.2;
            ctx.stroke();
        });

        const trees = [
            [-0.12, -0.08], [-0.08, -0.12], [-0.02, -0.10], [0.04, -0.14],
            [-0.14,  0.04], [-0.08,  0.08], [-0.02,  0.06], [0.04,  0.02]
        ];
        const treeR = Math.max(4.5, Math.min(8.5, Math.min(width, height) * 0.0095));
        trees.forEach(([vx, vy]) => {
            const p = vToScreen(vx, vy);
            ctx.beginPath();
            ctx.arc(p.x, p.y, treeR, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(34, 197, 94, 0.32)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(134, 239, 172, 0.45)';
            ctx.lineWidth = 1;
            ctx.stroke();
        });
    }

    function drawHeaderAndCompass() {
        const titleSize = Math.max(13, Math.min(21, width * 0.017));
        ctx.font = `700 ${titleSize}px "Space Grotesk", sans-serif`;
        ctx.fillStyle = 'rgba(251, 191, 36, 0.78)';
        ctx.textAlign = 'center';
        ctx.fillText('The Shinobi Continent', width * 0.5, Math.max(68, height * 0.105));

        if (!isPortrait) {
            const cx = Math.max(48, width * 0.055);
            const cy = Math.max(125, height * 0.18);
            const cr = Math.max(16, Math.min(24, width * 0.019));

            ctx.save();
            ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(cx, cy, cr, 0, Math.PI * 2);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(cx, cy - cr - 5);
            ctx.lineTo(cx + 4, cy - 2);
            ctx.lineTo(cx, cy + cr + 5);
            ctx.lineTo(cx - 4, cy - 2);
            ctx.closePath();
            ctx.fillStyle = 'rgba(249, 115, 22, 0.75)';
            ctx.fill();

            ctx.font = '700 10px monospace';
            ctx.fillStyle = '#FBBF24';
            ctx.textAlign = 'center';
            ctx.fillText('N', cx, cy - cr - 8);
            ctx.restore();
        }
    }

    function drawChakraPulses() {
        const dotR = Math.max(2.2, Math.min(4.2, Math.min(width, height) * 0.0045));

        routes.forEach(([fromId, toId], idx) => {
            const a = getLocationById(fromId);
            const b = getLocationById(toId);
            if (!a || !b) return;

            const p1 = vToScreen(a.vx, a.vy);
            const p2 = vToScreen(b.vx, b.vy);

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = 'rgba(251, 191, 36, 0.22)';
            ctx.lineWidth = 1.3;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);

            const t = ((pulsePhase * 0.32 + idx * 0.19) % 1 + 1) % 1;
            const px = p1.x + (p2.x - p1.x) * t;
            const py = p1.y + (p2.y - p1.y) * t;

            ctx.beginPath();
            ctx.arc(px, py, dotR, 0, Math.PI * 2);
            ctx.fillStyle = '#22D3EE';
            ctx.fill();
        });
    }

    function drawPins() {
        const baseR = Math.max(14, Math.min(22, Math.min(width, height) * 0.025));
        const fontSize = Math.max(9.5, Math.min(12, Math.round(baseR * 0.56)));

        locations.forEach((loc) => {
            const p = vToScreen(loc.vx, loc.vy);
            const isHovered = hoveredLoc && hoveredLoc.id === loc.id;
            const pulse = 1 + Math.sin(pulsePhase * 3 + loc.vx * 10) * 0.14;
            const r = isHovered ? baseR * 1.22 : baseR;

            ctx.beginPath();
            ctx.arc(p.x, p.y, r * 1.45 * pulse, 0, Math.PI * 2);
            ctx.fillStyle = loc.color + '29';
            ctx.fill();

            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(11, 16, 30, 0.94)';
            ctx.fill();
            ctx.lineWidth = isHovered ? 3 : 2;
            ctx.strokeStyle = loc.color;
            ctx.stroke();

            ctx.font = `${Math.round(r * 0.72)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(loc.icon, p.x, p.y + 1);

            ctx.font = `700 ${fontSize}px "Space Grotesk", sans-serif`;
            const textW = ctx.measureText(loc.label).width + 10;
            const pillH = fontSize + 6;
            const pillY = p.y + r + 4;

            ctx.fillStyle = 'rgba(7, 10, 18, 0.90)';
            ctx.fillRect(p.x - textW / 2, pillY, textW, pillH);
            ctx.strokeStyle = loc.color + 'AA';
            ctx.lineWidth = 1;
            ctx.strokeRect(p.x - textW / 2, pillY, textW, pillH);

            ctx.fillStyle = '#F8FAFC';
            ctx.fillText(loc.label, p.x, pillY + pillH / 2 + 0.5);
        });
    }

    function drawLegend() {
        if (width < 520) return;
        const lx = 18;
        const ly = height - 86;
        const lw = 166;
        const lh = 64;

        ctx.fillStyle = 'rgba(8, 12, 22, 0.82)';
        ctx.fillRect(lx, ly, lw, lh);
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.28)';
        ctx.lineWidth = 1;
        ctx.strokeRect(lx, ly, lw, lh);

        ctx.font = '700 9.5px monospace';
        ctx.fillStyle = '#FBBF24';
        ctx.textAlign = 'left';
        ctx.fillText('TACTICAL LEGEND', lx + 10, ly + 15);

        ctx.font = '9px monospace';
        ctx.fillStyle = '#CBD5E1';
        ctx.fillText('--- Chakra Route', lx + 10, ly + 31);
        ctx.fillStyle = '#22D3EE';
        ctx.fillText('● Active Pulse', lx + 10, ly + 46);
        ctx.fillStyle = '#F97316';
        ctx.fillText('◎ Scroll Landmark', lx + 10, ly + 58);
    }

    function render() {
        pulsePhase += 0.016;
        ctx.clearRect(0, 0, width, height);

        drawSea();
        drawContinent();
        drawFeatures();
        drawHeaderAndCompass();
        drawChakraPulses();
        drawPins();
        drawLegend();

        requestAnimationFrame(render);
    }

    render();
})();