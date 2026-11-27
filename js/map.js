// js/map.js - Interactive Shinobi World Map & Camera Controller
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

    let isDragging = false;
    let dragMoved = false;
    let lastPointer = { x: 0, y: 0 };
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

    // Camera travel helper exposed to main.js
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

    canvas.addEventListener('pointerdown', (e) => {
        isDragging = true;
        dragMoved = false;
        lastPointer = { x: e.clientX, y: e.clientY };
        canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener('pointermove', (e) => {
        if (isDragging) {
            const dx = e.clientX - lastPointer.x;
            const dy = e.clientY - lastPointer.y;
            if (Math.hypot(dx, dy) > 4) dragMoved = true;

            cam.targetX -= dx / cam.zoom;
            cam.targetY -= dy / cam.zoom;
            // Clamp pan bounds
            cam.targetX = Math.max(-460, Math.min(460, cam.targetX));
            cam.targetY = Math.max(-300, Math.min(300, cam.targetY));
            lastPointer = { x: e.clientX, y: e.clientY };
            return;
        }

        const hit = findLocationAtScreen(e.clientX, e.clientY);
        hoveredLoc = hit;
        canvas.style.cursor = hit ? 'pointer' : 'grab';
    });

    canvas.addEventListener('pointerup', (e) => {
        const wasClick = isDragging && !dragMoved;
        isDragging = false;
        if (canvas.hasPointerCapture(e.pointerId)) {
            canvas.releasePointerCapture(e.pointerId);
        }

        if (wasClick) {
            const hit = findLocationAtScreen(e.clientX, e.clientY);
            if (hit && typeof window.openLocationScroll === 'function') {
                window.openLocationScroll(hit.id);
            }
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

        // Subtle radar rings around center
        const center = worldToScreen(0, 0);
        [180, 340, 500].forEach((r) => {
            ctx.beginPath();
            ctx.arc(center.x, center.y, r * cam.zoom, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(34, 211, 238, 0.07)';
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
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
            ctx.lineWidth = 1.5 * cam.zoom;
            ctx.setLineDash([6, 6]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Traveling chakra pulse along route
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

            // Outer chakra aura
            ctx.beginPath();
            ctx.arc(p.x, p.y, r * 1.45 * pulse, 0, Math.PI * 2);
            ctx.fillStyle = loc.color + '1A';
            ctx.fill();

            // Beacon ring
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.fillStyle = '#0B101E';
            ctx.fill();
            ctx.lineWidth = isHovered ? 3 : 2;
            ctx.strokeStyle = loc.color;
            ctx.stroke();

            // Landmark icon
            ctx.font = `${Math.round(16 * cam.zoom)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(loc.icon, p.x, p.y + 1);

            // Title & tag label
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

        // Deep radial night backdrop
        const bgGrad = ctx.createRadialGradient(width * 0.5, height * 0.45, 40, width * 0.5, height * 0.5, Math.max(width, height) * 0.75);
        bgGrad.addColorStop(0, '#12182B');
        bgGrad.addColorStop(1, '#06080E');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        drawMapGrid();
        drawRoutes();
        drawLandmarks();

        requestAnimationFrame(render);
    }

    render();
})();