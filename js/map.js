// js/map.js - Interactive Shinobi World Map, Terrain Renderer & Camera Controller
(() => {
    const canvas = document.getElementById('worldMapCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const locations = [
        { id: 'about',     label: 'Leaf Outpost',  tag: 'ABOUT',     x: -360, y: -110, color: '#F97316', icon: '🏯' },
        { id: 'education', label: 'Wits Academy',  tag: 'EDUCATION', x: -120, y: -170, color: '#FBBF24', icon: '🎓' },
        { id: 'skills',    label: 'Chakra Dojo',   tag: 'SKILLS',    x:  150, y: -120, color: '#22D3EE', icon: '🌀' },
        { id: 'awards',    label: 'Hall of Fame',  tag: 'HONOURS',   x:  360, y:   40, color: '#A855F7', icon: '📜' },
        { id: 'projects',  label: 'Mission Board', tag: 'PROJECTS',  x:  110, y:  165, color: '#F97316', icon: '🎯' },
        { id: 'contact',   label: 'Summon Shrine', tag: 'CONTACT',   x: -220, y:  145, color: '#22D3EE', icon: '🦅' }
    ];

    const routes = [
        ['about', 'education'],
        ['education', 'skills'],
        ['skills', 'awards'],
        ['awards', 'projects'],
        ['projects', 'contact'],
        ['contact', 'about'],
        ['education', 'contact'],
        ['skills', 'projects']
    ];

    let width = 0;
    let height = 0;

    // Camera state in world coordinates
    const cam = {
        x: 0,
        y: 0,
        zoom: 1,
        targetX: 0,
        targetY: 0,
        targetZoom: 1
    };

    let dragStart = null;
    let didPan = false;
    let hoveredLoc = null;
    let pulsePhase = 0;

    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
        const baseScale = Math.min(width / 960, height / 620);
        cam.targetZoom = Math.max(0.62, Math.min(1.15, baseScale));
    }

    window.addEventListener('resize', resize);
    resize();

    function worldToScreen(wx, wy) {
        return {
            x: width / 2 + (wx - cam.x) * cam.zoom,
            y: height / 2 + (wy - cam.y) * cam.zoom
        };
    }

    function screenToWorld(sx, sy) {
        return {
            x: (sx - width / 2) / cam.zoom + cam.x,
            y: (sy - height / 2) / cam.zoom + cam.y
        };
    }

    function getLocationById(id) {
        return locations.find((l) => l.id === id) || null;
    }

    function findLocationAtScreen(sx, sy) {
        const w = screenToWorld(sx, sy);
        for (const loc of locations) {
            const dx = w.x - loc.x;
            const dy = w.y - loc.y;
            if (Math.hypot(dx, dy) <= 44) return loc;
        }
        return null;
    }

    // Global map interface exposed to main.js
    window.ShinobiMap = {
        focusLocation(id, onArrived) {
            const loc = getLocationById(id);
            if (!loc) return;
            cam.targetX = loc.x;
            cam.targetY = loc.y;
            cam.targetZoom = Math.max(1.05, Math.min(1.35, width < 640 ? 0.95 : 1.25));

            window.clearTimeout(window.ShinobiMap._arriveTimer);
            window.ShinobiMap._arriveTimer = window.setTimeout(() => {
                if (typeof onArrived === 'function') onArrived(loc);
            }, 340);
        },
        resetView() {
            const baseScale = Math.min(width / 960, height / 620);
            cam.targetX = 0;
            cam.targetY = 0;
            cam.targetZoom = Math.max(0.62, Math.min(1.15, baseScale));
        }
    };

    // Canvas Mouse & Interaction Handlers
    canvas.addEventListener('mousedown', (e) => {
        dragStart = { x: e.clientX, y: e.clientY };
        didPan = false;
    });

    window.addEventListener('mousemove', (e) => {
        if (dragStart) {
            const dx = e.clientX - dragStart.x;
            const dy = e.clientY - dragStart.y;
            if (Math.hypot(dx, dy) > 5) {
                didPan = true;
                cam.targetX -= dx / cam.zoom;
                cam.targetY -= dy / cam.zoom;
                cam.targetX = Math.max(-460, Math.min(460, cam.targetX));
                cam.targetY = Math.max(-300, Math.min(300, cam.targetY));
                dragStart = { x: e.clientX, y: e.clientY };
            }
        }
        hoveredLoc = findLocationAtScreen(e.clientX, e.clientY);
        canvas.style.cursor = hoveredLoc ? 'pointer' : 'grab';
    });

    window.addEventListener('mouseup', () => {
        dragStart = null;
    });

    canvas.addEventListener('click', (e) => {
        if (didPan) return;
        const hit = findLocationAtScreen(e.clientX, e.clientY);
        if (hit && typeof window.openLocationScroll === 'function') {
            window.openLocationScroll(hit.id);
        }
    });

    function drawMapGrid() {
        const step = 64 * cam.zoom;
        const offsetX = ((width / 2 - cam.x * cam.zoom) % step + step) % step;
        const offsetY = ((height / 2 - cam.y * cam.zoom) % step + step) % step;

        ctx.strokeStyle = 'rgba(249, 115, 22, 0.06)';
        ctx.lineWidth = 1;

        for (let x = offsetX; x < width; x += step) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = offsetY; y < height; y += step) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        const center = worldToScreen(0, 0);
        [180, 340, 500].forEach((r) => {
            ctx.beginPath();
            ctx.arc(center.x, center.y, r * cam.zoom, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(34, 211, 238, 0.07)';
            ctx.stroke();
        });
    }

    function drawTerrain() {
        // 1. Leaf Outpost (-360, -110): Forest grove clusters
        const leafPos = worldToScreen(-360, -110);
        const groveOffsets = [
            [-55, -25, 34], [-25, -45, 28], [15, -35, 32],
            [-45,  22, 30], [ 25,  18, 36], [ 42, -10, 26]
        ];
        groveOffsets.forEach(([ox, oy, rad]) => {
            ctx.beginPath();
            ctx.arc(leafPos.x + ox * cam.zoom, leafPos.y + oy * cam.zoom, rad * cam.zoom, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(16, 185, 129, 0.065)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(249, 115, 22, 0.14)';
            ctx.lineWidth = 1 * cam.zoom;
            ctx.stroke();
        });

        // 2. Wits Academy (-120, -170): Mountain ridge peaks
        const acadPos = worldToScreen(-120, -170);
        const peaks = [
            [-68, 12, -38, -28, -8, 12],
            [-18, 14,  18, -36, 54, 14],
            [ 28, 12,  62, -20, 92, 12]
        ];
        peaks.forEach(([x1, y1, x2, y2, x3, y3]) => {
            ctx.beginPath();
            ctx.moveTo(acadPos.x + x1 * cam.zoom, acadPos.y + y1 * cam.zoom);
            ctx.lineTo(acadPos.x + x2 * cam.zoom, acadPos.y + y2 * cam.zoom);
            ctx.lineTo(acadPos.x + x3 * cam.zoom, acadPos.y + y3 * cam.zoom);
            ctx.closePath();
            ctx.fillStyle = 'rgba(148, 163, 184, 0.06)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(251, 191, 36, 0.18)';
            ctx.lineWidth = 1.2 * cam.zoom;
            ctx.stroke();
        });

        // 3. Chakra Dojo (150, -120): Swirling chakra vortex arcs
        const dojoPos = worldToScreen(150, -120);
        [44, 72, 100].forEach((ringR, idx) => {
            ctx.beginPath();
            ctx.arc(
                dojoPos.x,
                dojoPos.y,
                ringR * cam.zoom,
                pulsePhase * (idx % 2 === 0 ? 0.6 : -0.5),
                pulsePhase * (idx % 2 === 0 ? 0.6 : -0.5) + Math.PI * 1.35
            );
            ctx.strokeStyle = `rgba(34, 211, 238, ${0.18 - idx * 0.04})`;
            ctx.lineWidth = 1.4 * cam.zoom;
            ctx.stroke();
        });

        // 4. Hall of Fame (360, 40): Hexagonal plateau seal
        const hallPos = worldToScreen(360, 40);
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i + 0.25;
            const hx = hallPos.x + Math.cos(angle) * 76 * cam.zoom;
            const hy = hallPos.y + Math.sin(angle) * 76 * cam.zoom;
            if (i === 0) ctx.moveTo(hx, hy);
            else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(168, 85, 247, 0.06)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.22)';
        ctx.lineWidth = 1.4 * cam.zoom;
        ctx.stroke();

        // 5. Mission Board (110, 165): Tactical contour / canyon arcs
        const missPos = worldToScreen(110, 165);
        [42, 68, 94].forEach((r, i) => {
            ctx.beginPath();
            ctx.ellipse(missPos.x, missPos.y, r * 1.25 * cam.zoom, r * 0.72 * cam.zoom, -0.18, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(249, 115, 22, ${0.15 - i * 0.03})`;
            ctx.lineWidth = 1.1 * cam.zoom;
            ctx.stroke();
        });

        // 6. Summon Shrine (-220, 145): Summoning circle & inner cross-sigil
        const shrinePos = worldToScreen(-220, 145);
        const sRad = 66 * cam.zoom;
        ctx.beginPath();
        ctx.arc(shrinePos.x, shrinePos.y, sRad, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.22)';
        ctx.lineWidth = 1.3 * cam.zoom;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(shrinePos.x - sRad * 0.75, shrinePos.y);
        ctx.lineTo(shrinePos.x + sRad * 0.75, shrinePos.y);
        ctx.moveTo(shrinePos.x, shrinePos.y - sRad * 0.75);
        ctx.lineTo(shrinePos.x, shrinePos.y + sRad * 0.75);
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.12)';
        ctx.lineWidth = 1 * cam.zoom;
        ctx.stroke();
    }

    function drawRoutes() {
        routes.forEach(([fromId, toId], idx) => {
            const a = getLocationById(fromId);
            const b = getLocationById(toId);
            if (!a || !b) return;

            const p1 = worldToScreen(a.x, a.y);
            const p2 = worldToScreen(b.x, b.y);

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
            ctx.lineWidth = 1.5 * cam.zoom;
            ctx.setLineDash([6, 6]);
            ctx.stroke();
            ctx.setLineDash([]);

            const t = ((pulsePhase * 0.35 + idx * 0.17) % 1 + 1) % 1;
            const px = p1.x + (p2.x - p1.x) * t;
            const py = p1.y + (p2.y - p1.y) * t;

            ctx.beginPath();
            ctx.arc(px, py, 2.6 * cam.zoom, 0, Math.PI * 2);
            ctx.fillStyle = '#22D3EE';
            ctx.fill();
        });
    }

    function drawLandmarks() {
        locations.forEach((loc) => {
            const p = worldToScreen(loc.x, loc.y);
            const isHovered = hoveredLoc && hoveredLoc.id === loc.id;
            const pulse = 1 + Math.sin(pulsePhase * 3 + loc.x * 0.01) * 0.14;
            const r = (isHovered ? 28 : 23) * cam.zoom;

            ctx.beginPath();
            ctx.arc(p.x, p.y, r * 1.45 * pulse, 0, Math.PI * 2);
            ctx.fillStyle = loc.color + '1A';
            ctx.fill();

            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.fillStyle = '#0B101E';
            ctx.fill();
            ctx.lineWidth = isHovered ? 3 : 2;
            ctx.strokeStyle = loc.color;
            ctx.stroke();

            ctx.font = `${Math.round(16 * cam.zoom)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(loc.icon, p.x, p.y + 1);

            ctx.font = `700 ${Math.round(12 * cam.zoom)}px "Space Grotesk", sans-serif`;
            ctx.fillStyle = '#F8FAFC';
            ctx.fillText(loc.label, p.x, p.y + r + 14 * cam.zoom);

            ctx.font = `600 ${Math.round(9.5 * cam.zoom)}px monospace`;
            ctx.fillStyle = loc.color;
            ctx.fillText(`[ ${loc.tag} ]`, p.x, p.y + r + 27 * cam.zoom);
        });
    }

    function render() {
        pulsePhase += 0.016;
        cam.x += (cam.targetX - cam.x) * 0.09;
        cam.y += (cam.targetY - cam.y) * 0.09;
        cam.zoom += (cam.targetZoom - cam.zoom) * 0.09;

        ctx.clearRect(0, 0, width, height);

        const bgGrad = ctx.createRadialGradient(width * 0.5, height * 0.45, 40, width * 0.5, height * 0.5, Math.max(width, height) * 0.75);
        bgGrad.addColorStop(0, '#12182B');
        bgGrad.addColorStop(1, '#06080E');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        drawMapGrid();
        drawTerrain();
        drawRoutes();
        drawLandmarks();

        requestAnimationFrame(render);
    }

    render();
})();