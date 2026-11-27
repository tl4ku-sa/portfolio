// js/map.js - Procedural Vector Shinobi Continent Map & Interactive Pins
(() => {
    const canvas = document.getElementById('worldMapCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Landmarks mapped to logical vector coordinates on the continent
    const locations = [
        { id: 'about',     label: 'Leaf Outpost',  tag: 'HIDDEN LEAF',   vx: -0.05, vy: -0.02, color: '#F97316', icon: '🏯' },
        { id: 'education', label: 'Wits Academy',  tag: 'HIDDEN CLOUD',  vx: -0.02, vy: -0.28, color: '#FBBF24', icon: '🎓' },
        { id: 'skills',    label: 'Chakra Dojo',   tag: 'STONE PEAKS',   vx: -0.28, vy: -0.10, color: '#22D3EE', icon: '🌀' },
        { id: 'awards',    label: 'Hall of Fame',  tag: 'VALLEY OF END', vx:  0.27, vy:  0.19, color: '#A855F7', icon: '📜' },
        { id: 'projects',  label: 'Mission Board', tag: 'HIDDEN SAND',   vx:  0.22, vy: -0.06, color: '#F97316', icon: '🎯' },
        { id: 'contact',   label: 'Summon Shrine', tag: 'HIDDEN MIST',   vx: -0.08, vy:  0.26, color: '#22D3EE', icon: '🦅' }
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
    let hoveredLoc = null;
    let pulsePhase = 0;

    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    }

    window.addEventListener('resize', resize);
    resize();

    // Converts vector map coordinates (-0.5 to 0.5) to actual screen pixels
    function vToScreen(vx, vy) {
        // Use a bounded map scaling box so the continent maintains proportions
        const mapDim = Math.min(width * 0.95, height * 0.90);
        return {
            x: width * 0.5 + vx * mapDim,
            y: height * 0.53 + vy * mapDim
        };
    }

    function getLocationById(id) {
        return locations.find((l) => l.id === id) || null;
    }

    function findLocationAtScreen(sx, sy) {
        const hitRadius = Math.max(26, Math.min(42, Math.min(width, height) * 0.05));
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

    // 1. Sea & Background Atmosphere
    function drawSea() {
        const bgGrad = ctx.createRadialGradient(width * 0.5, height * 0.5, 50, width * 0.5, height * 0.5, Math.max(width, height) * 0.75);
        bgGrad.addColorStop(0, '#101B2B');
        bgGrad.addColorStop(0.6, '#0B1320');
        bgGrad.addColorStop(1, '#050912');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // Cartographic grid lines
        const step = Math.max(45, Math.min(75, Math.min(width, height) * 0.08));
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

        // Animated ocean waves in Sea of Mist (bottom)
        const waveY = height * 0.92;
        ctx.beginPath();
        for (let x = 0; x <= width; x += 20) {
            const wy = waveY + Math.sin(x * 0.02 + pulsePhase * 2) * 4;
            if (x === 0) ctx.moveTo(x, wy);
            else ctx.lineTo(x, wy);
        }
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.12)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.font = '600 11px monospace';
        ctx.fillStyle = 'rgba(34, 211, 238, 0.35)';
        ctx.textAlign = 'center';
        ctx.fillText('~ Sea of Mist ~', width * 0.5, height * 0.96);
    }

    // 2. Continent Island & Biome Regions
    function drawContinent() {
        const islandPath = [
            [-0.42, -0.22], [-0.35, -0.36], [-0.18, -0.42], [0.05, -0.41],
            [0.25, -0.36],  [0.41, -0.24],  [0.43, -0.05],  [0.42,  0.18],
            [0.34,  0.34],  [0.18,  0.42],  [-0.05, 0.43],  [-0.22, 0.38],
            [-0.38, 0.28],  [-0.44, 0.08],  [-0.45, -0.08]
        ].map(([vx, vy]) => vToScreen(vx, vy));

        // Outer shallow coastline glow
        ctx.beginPath();
        islandPath.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.fillStyle = 'rgba(34, 211, 238, 0.08)';
        ctx.fill();
        ctx.lineWidth = 14;
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.12)';
        ctx.stroke();

        // Main continent landmass fill
        ctx.beginPath();
        islandPath.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();

        const landGrad = ctx.createLinearGradient(0, height * 0.2, 0, height * 0.8);
        landGrad.addColorStop(0, '#1E2A20');
        landGrad.addColorStop(0.4, '#19241C');
        landGrad.addColorStop(0.7, '#242A1D');
        landGrad.addColorStop(1, '#1A2228');
        ctx.fillStyle = landGrad;
        ctx.fill();

        ctx.lineWidth = 2.2;
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
        ctx.stroke();

        // Biome Sub-Regions (Stone Peaks / Hidden Sand Desert / Forest of Death)
        // Stone Peaks (Left Brown Mountain Zone)
        const stoneZone = [[-0.42, -0.22], [-0.35, -0.36], [-0.18, -0.42], [-0.15, -0.12], [-0.22, 0.15], [-0.38, 0.28], [-0.44, 0.08], [-0.45, -0.08]].map(([vx, vy]) => vToScreen(vx, vy));
        ctx.beginPath();
        stoneZone.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.fillStyle = 'rgba(88, 62, 42, 0.28)';
        ctx.fill();

        // Wind Desert (Right Sand Zone)
        const sandZone = [[0.15, -0.38], [0.25, -0.36], [0.41, -0.24], [0.43, -0.05], [0.42, 0.18], [0.22, 0.08], [0.12, -0.18]].map(([vx, vy]) => vToScreen(vx, vy));
        ctx.beginPath();
        sandZone.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.fillStyle = 'rgba(180, 130, 60, 0.22)';
        ctx.fill();

        // Forest of Death (Central-Left Lush Woods)
        const forestZone = [[-0.20, -0.18], [0.08, -0.20], [0.08, 0.15], [-0.20, 0.18]].map(([vx, vy]) => vToScreen(vx, vy));
        ctx.beginPath();
        forestZone.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
        ctx.fill();
    }

    // 3. Rivers & Mountain Features
    function drawFeatures() {
        // Main River (Blue Water Stream)
        const riverPts = [[-0.05, -0.40], [0.02, -0.22], [0.04, 0.02], [-0.04, 0.22], [0.02, 0.42]].map(([vx, vy]) => vToScreen(vx, vy));
        ctx.beginPath();
        riverPts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.55)';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Mountain Triangles (Stone Peaks & Northern Mountains)
        const mtns = [
            [-0.32, -0.25], [-0.36, -0.15], [-0.28, -0.18], [-0.34, -0.02], [-0.30, 0.10],
            [-0.10, -0.35], [-0.02, -0.36], [0.08, -0.33], [0.22, -0.30], [0.32, -0.22]
        ];
        mtns.forEach(([vx, vy]) => {
            const p = vToScreen(vx, vy);
            const sz = Math.max(8, Math.min(14, Math.min(width, height) * 0.016));
            ctx.beginPath();
            ctx.moveTo(p.x, p.y - sz);
            ctx.lineTo(p.x + sz * 0.85, p.y + sz * 0.7);
            ctx.lineTo(p.x - sz * 0.85, p.y + sz * 0.7);
            ctx.closePath();
            ctx.fillStyle = 'rgba(148, 163, 184, 0.22)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(253, 224, 71, 0.38)';
            ctx.lineWidth = 1.2;
            ctx.stroke();
        });

        // Forest Trees Dot Clusters (Hidden Leaf Woods)
        const trees = [
            [-0.12, -0.08], [-0.08, -0.12], [-0.02, -0.10], [0.04, -0.14],
            [-0.14,  0.04], [-0.08,  0.08], [-0.02,  0.06], [0.04,  0.02]
        ];
        trees.forEach(([vx, vy]) => {
            const p = vToScreen(vx, vy);
            const r = Math.max(5, Math.min(9, Math.min(width, height) * 0.01));
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(34, 197, 94, 0.32)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(134, 239, 172, 0.45)';
            ctx.lineWidth = 1;
            ctx.stroke();
        });
    }

    // 4. Cartographic Header & Compass Rose
    function drawHeaderAndCompass() {
        ctx.font = `700 ${Math.max(14, Math.min(22, width * 0.018))}px "Space Grotesk", sans-serif`;
        ctx.fillStyle = 'rgba(251, 191, 36, 0.75)';
        ctx.textAlign = 'center';
        ctx.fillText('The Shinobi Continent', width * 0.5, Math.max(38, height * 0.06));

        // Compass Rose in top-left
        const cx = Math.max(50, width * 0.06);
        const cy = Math.max(110, height * 0.16);
        const cr = Math.max(18, Math.min(26, width * 0.02));

        ctx.save();
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx, cy - cr - 6);
        ctx.lineTo(cx + 4, cy - 2);
        ctx.lineTo(cx, cy + cr + 6);
        ctx.lineTo(cx - 4, cy - 2);
        ctx.closePath();
        ctx.fillStyle = 'rgba(249, 115, 22, 0.75)';
        ctx.fill();

        ctx.font = '700 10px monospace';
        ctx.fillStyle = '#FBBF24';
        ctx.textAlign = 'center';
        ctx.fillText('N', cx, cy - cr - 9);
        ctx.restore();
    }

    // 5. Animated Chakra Routes & Particles
    function drawChakraPulses() {
        const dotR = Math.max(2.5, Math.min(4.5, Math.min(width, height) * 0.005));

        routes.forEach(([fromId, toId], idx) => {
            const a = getLocationById(fromId);
            const b = getLocationById(toId);
            if (!a || !b) return;

            const p1 = vToScreen(a.vx, a.vy);
            const p2 = vToScreen(b.vx, b.vy);

            // Dashed connection trail
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = 'rgba(251, 191, 36, 0.22)';
            ctx.lineWidth = 1.4;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Moving chakra pulse orb
            const t = ((pulsePhase * 0.32 + idx * 0.19) % 1 + 1) % 1;
            const px = p1.x + (p2.x - p1.x) * t;
            const py = p1.y + (p2.y - p1.y) * t;

            ctx.beginPath();
            ctx.arc(px, py, dotR, 0, Math.PI * 2);
            ctx.fillStyle = '#22D3EE';
            ctx.fill();
            ctx.shadowColor = '#22D3EE';
            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.shadowBlur = 0;
        });
    }

    // 6. Interactive Landmark Pins
    function drawPins() {
        const baseR = Math.max(16, Math.min(23, Math.min(width, height) * 0.026));

        locations.forEach((loc) => {
            const p = vToScreen(loc.vx, loc.vy);
            const isHovered = hoveredLoc && hoveredLoc.id === loc.id;
            const pulse = 1 + Math.sin(pulsePhase * 3 + loc.vx * 10) * 0.14;
            const r = isHovered ? baseR * 1.25 : baseR;

            // Outer glowing chakra ring
            ctx.beginPath();
            ctx.arc(p.x, p.y, r * 1.45 * pulse, 0, Math.PI * 2);
            ctx.fillStyle = loc.color + '29';
            ctx.fill();

            // Pin core badge
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(11, 16, 30, 0.94)';
            ctx.fill();
            ctx.lineWidth = isHovered ? 3 : 2;
            ctx.strokeStyle = loc.color;
            ctx.stroke();

            // Icon
            ctx.font = `${Math.round(r * 0.74)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(loc.icon, p.x, p.y + 1);

            // Label pill
            const fontSize = Math.max(10, Math.min(12, Math.round(r * 0.58)));
            ctx.font = `700 ${fontSize}px "Space Grotesk", sans-serif`;
            const textW = ctx.measureText(loc.label).width + 12;
            const pillH = fontSize + 7;
            const pillY = p.y + r + 5;

            ctx.fillStyle = 'rgba(7, 10, 18, 0.90)';
            ctx.fillRect(p.x - textW / 2, pillY, textW, pillH);
            ctx.strokeStyle = loc.color + 'AA';
            ctx.lineWidth = 1;
            ctx.strokeRect(p.x - textW / 2, pillY, textW, pillH);

            ctx.fillStyle = '#F8FAFC';
            ctx.fillText(loc.label, p.x, pillY + pillH / 2 + 0.5);
        });
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

        requestAnimationFrame(render);
    }

    render();
})();