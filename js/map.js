// js/map.js - Full Naruto / Shinobi World Map Background & Camera Controller
(() => {
    const canvas = document.getElementById('worldMapCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const locations = [
        { id: 'about',     label: 'Leaf Outpost',  tag: 'LAND OF FIRE',   x: -340, y: -95,  color: '#F97316', icon: '🏯' },
        { id: 'education', label: 'Wits Academy',  tag: 'NORTHERN PEAKS', x: -105, y: -165, color: '#FBBF24', icon: '🎓' },
        { id: 'skills',    label: 'Chakra Dojo',   tag: 'CHAKRA VALLEY',  x:  155, y: -115, color: '#22D3EE', icon: '🌀' },
        { id: 'awards',    label: 'Hall of Fame',  tag: 'ANCIENT RUINS',  x:  365, y:   45, color: '#A855F7', icon: '📜' },
        { id: 'projects',  label: 'Mission Board', tag: 'FRONTIER POST',  x:  115, y:  165, color: '#F97316', icon: '🎯' },
        { id: 'contact',   label: 'Summon Shrine', tag: 'SUMMON GROUNDS', x: -225, y:  145, color: '#22D3EE', icon: '🦅' }
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
        const baseScale = Math.min(width / 980, height / 640);
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
            if (Math.hypot(w.x - loc.x, w.y - loc.y) <= 44) return loc;
        }
        return null;
    }

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
            const baseScale = Math.min(width / 980, height / 640);
            cam.targetX = 0;
            cam.targetY = 0;
            cam.targetZoom = Math.max(0.62, Math.min(1.15, baseScale));
        }
    };

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

    function drawSeaAndGrid() {
        // Deep shinobi sea gradient
        const seaGrad = ctx.createRadialGradient(
            width * 0.5,
            height * 0.45,
            50,
            width * 0.5,
            height * 0.5,
            Math.max(width, height) * 0.8
        );
        seaGrad.addColorStop(0, '#0F1B2E');
        seaGrad.addColorStop(0.55, '#09101D');
        seaGrad.addColorStop(1, '#050811');
        ctx.fillStyle = seaGrad;
        ctx.fillRect(0, 0, width, height);

        // Cartographic longitude/latitude grid
        const step = 70 * cam.zoom;
        const offsetX = ((width / 2 - cam.x * cam.zoom) % step + step) % step;
        const offsetY = ((height / 2 - cam.y * cam.zoom) % step + step) % step;

        ctx.strokeStyle = 'rgba(251, 191, 36, 0.05)';
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

        // Compass rose in upper-right map corner
        const cx = width - Math.max(70, width * 0.08);
        const cy = Math.max(105, height * 0.16);
        const cr = 26;
        ctx.save();
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.28)';
        ctx.fillStyle = 'rgba(251, 191, 36, 0.55)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx, cy - cr - 6);
        ctx.lineTo(cx + 5, cy - 4);
        ctx.lineTo(cx, cy + cr + 6);
        ctx.lineTo(cx - 5, cy - 4);
        ctx.closePath();
        ctx.fill();

        ctx.font = '700 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('N', cx, cy - cr - 10);
        ctx.restore();
    }

    function drawContinentAndRegions() {
        const pts = [
            [-540, -140], [-450, -250], [-250, -295], [-40, -280],
            [ 160, -250], [ 360, -180], [ 510, -50],  [ 520,  110],
            [ 410,  235], [ 210,  275], [ -20,  260], [-240,  270],
            [-450,  210], [-560,   60]
        ].map(([wx, wy]) => worldToScreen(wx, wy));

        // Outer coastal aura
        ctx.beginPath();
        pts.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.fillStyle = 'rgba(28, 36, 28, 0.52)';
        ctx.fill();
        ctx.lineWidth = 6 * cam.zoom;
        ctx.strokeStyle = 'rgba(249, 115, 22, 0.10)';
        ctx.stroke();

        // Crisp continent border
        ctx.lineWidth = 1.8 * cam.zoom;
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.28)';
        ctx.stroke();

        // Winding river across the Land of Fire
        const riverPts = [
            [-470, -20], [-320, 10], [-160, -5], [10, 45], [170, 95], [320, 145]
        ].map(([wx, wy]) => worldToScreen(wx, wy));

        ctx.beginPath();
        riverPts.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.22)';
        ctx.lineWidth = 3.2 * cam.zoom;
        ctx.stroke();

        // Region territory rings & labels
        const zones = [
            { x: -340, y: -95,  r: 125, label: 'LAND OF FIRE',   color: 'rgba(249, 115, 22, 0.08)' },
            { x: -105, y: -165, r: 115, label: 'FROST & PEAKS',  color: 'rgba(251, 191, 36, 0.07)' },
            { x:  155, y: -115, r: 120, label: 'CHAKRA REALM',   color: 'rgba(34, 211, 238, 0.07)' },
            { x:  365, y:   45, r: 120, label: 'VALLEY OF END',  color: 'rgba(168, 85, 247, 0.08)' },
            { x:  115, y:  165, r: 115, label: 'BORDER FRONTIER',color: 'rgba(249, 115, 22, 0.07)' },
            { x: -225, y:  145, r: 115, label: 'MT. MYOBOKU',    color: 'rgba(34, 211, 238, 0.07)' }
        ];

        zones.forEach((z) => {
            const p = worldToScreen(z.x, z.y);
            ctx.beginPath();
            ctx.arc(p.x, p.y, z.r * cam.zoom, 0, Math.PI * 2);
            ctx.fillStyle = z.color;
            ctx.fill();
            ctx.setLineDash([4, 6]);
            ctx.strokeStyle = 'rgba(226, 232, 240, 0.12)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.font = `700 ${Math.max(8, Math.round(9 * cam.zoom))}px monospace`;
            ctx.fillStyle = 'rgba(226, 232, 240, 0.28)';
            ctx.textAlign = 'center';
            ctx.fillText(z.label, p.x, p.y - (z.r - 14) * cam.zoom);
        });

        // Forest tree clusters around Leaf Outpost
        const leaf = worldToScreen(-340, -95);
        const trees = [
            [-75, -35], [-50, -55], [-20, -45], [55, -25],
            [-65,  30], [-30,  45], [ 45,  32], [68,   8]
        ];
        trees.forEach(([ox, oy], idx) => {
            const tx = leaf.x + ox * cam.zoom;
            const ty = leaf.y + oy * cam.zoom;
            const s = (9 + (idx % 3) * 2) * cam.zoom;
            ctx.beginPath();
            ctx.moveTo(tx, ty - s);
            ctx.lineTo(tx + s * 0.8, ty + s * 0.65);
            ctx.lineTo(tx - s * 0.8, ty + s * 0.65);
            ctx.closePath();
            ctx.fillStyle = 'rgba(34, 197, 94, 0.18)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(134, 239, 172, 0.25)';
            ctx.lineWidth = 1;
            ctx.stroke();
        });

        // Mountain peaks near Wits Academy
        const acad = worldToScreen(-105, -165);
        const mtn = [
            [-82, 22, -52, -26, -22, 22],
            [-28, 24,  10, -34,  48, 24],
            [ 34, 22,  68, -18, 102, 22]
        ];
        mtn.forEach(([x1, y1, x2, y2, x3, y3]) => {
            ctx.beginPath();
            ctx.moveTo(acad.x + x1 * cam.zoom, acad.y + y1 * cam.zoom);
            ctx.lineTo(acad.x + x2 * cam.zoom, acad.y + y2 * cam.zoom);
            ctx.lineTo(acad.x + x3 * cam.zoom, acad.y + y3 * cam.zoom);
            ctx.closePath();
            ctx.fillStyle = 'rgba(148, 163, 184, 0.14)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(253, 224, 71, 0.26)';
            ctx.lineWidth = 1.2 * cam.zoom;
            ctx.stroke();
        });
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
            ctx.strokeStyle = 'rgba(251, 191, 36, 0.22)';
            ctx.lineWidth = 1.5 * cam.zoom;
            ctx.setLineDash([6, 6]);
            ctx.stroke();
            ctx.setLineDash([]);

            const t = ((pulsePhase * 0.35 + idx * 0.17) % 1 + 1) % 1;
            const px = p1.x + (p2.x - p1.x) * t;
            const py = p1.y + (p2.y - p1.y) * t;

            ctx.beginPath();
            ctx.arc(px, py, 3 * cam.zoom, 0, Math.PI * 2);
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
            ctx.fillStyle = loc.color + '22';
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

        drawSeaAndGrid();
        drawContinentAndRegions();
        drawRoutes();
        drawLandmarks();

        requestAnimationFrame(render);
    }

    render();
})();