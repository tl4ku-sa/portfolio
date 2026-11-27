// js/map.js - Shinobi Continent Map (assets/shinobi-continent.jpg) with Pan, Zoom & Pins
(() => {
    const canvas = document.getElementById('worldMapCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // World coordinates relative to the center of shinobi-continent.jpg
    const locations = [
        { id: 'about',     label: 'Leaf Outpost',  tag: 'HIDDEN LEAF',   x:  -20, y:  -25, color: '#F97316', icon: '🏯' },
        { id: 'education', label: 'Wits Academy',  tag: 'HIDDEN CLOUD',  x:  -25, y: -235, color: '#FBBF24', icon: '🎓' },
        { id: 'skills',    label: 'Chakra Dojo',   tag: 'STONE PEAKS',   x: -220, y: -105, color: '#22D3EE', icon: '🌀' },
        { id: 'awards',    label: 'Hall of Fame',  tag: 'VALLEY OF END', x:  215, y:  145, color: '#A855F7', icon: '📜' },
        { id: 'projects',  label: 'Mission Board', tag: 'HIDDEN SAND',   x:  210, y:  -35, color: '#F97316', icon: '🎯' },
        { id: 'contact',   label: 'Summon Shrine', tag: 'HIDDEN MIST',   x: -115, y:  140, color: '#22D3EE', icon: '🦅' }
    ];

    const routes = [
        ['about', 'education'],
        ['about', 'skills'],
        ['about', 'projects'],
        ['about', 'contact'],
        ['about', 'awards'],
        ['contact', 'awards']
    ];

    const mapImg = new Image();
    mapImg.src = 'assets/shinobi-continent.jpg';
    let imgLoaded = false;

    mapImg.onload = () => {
        imgLoaded = true;
        resetCamera();
    };

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

    function computeFitZoom() {
        if (!imgLoaded || !mapImg.naturalWidth || !mapImg.naturalHeight) {
            return Math.max(0.65, Math.min(1.15, Math.min(width / 900, height / 750)));
        }
        const scaleX = (width * 0.92) / mapImg.naturalWidth;
        const scaleY = (height * 0.86) / mapImg.naturalHeight;
        return Math.max(0.45, Math.min(1.25, Math.min(scaleX, scaleY)));
    }

    function resetCamera() {
        cam.targetX = 0;
        cam.targetY = 0;
        cam.targetZoom = computeFitZoom();
    }

    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
        cam.targetZoom = computeFitZoom();
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
            if (Math.hypot(w.x - loc.x, w.y - loc.y) <= 42) return loc;
        }
        return null;
    }

    window.ShinobiMap = {
        focusLocation(id, onArrived) {
            const loc = getLocationById(id);
            if (!loc) return;
            cam.targetX = loc.x;
            cam.targetY = loc.y;
            cam.targetZoom = Math.max(1.05, Math.min(1.45, width < 640 ? 0.95 : 1.25));

            window.clearTimeout(window.ShinobiMap._arriveTimer);
            window.ShinobiMap._arriveTimer = window.setTimeout(() => {
                if (typeof onArrived === 'function') onArrived(loc);
            }, 340);
        },
        resetView() {
            resetCamera();
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
                cam.targetX = Math.max(-420, Math.min(420, cam.targetX));
                cam.targetY = Math.max(-380, Math.min(380, cam.targetY));
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

    function drawMapImage() {
        ctx.fillStyle = '#070A12';
        ctx.fillRect(0, 0, width, height);

        if (!imgLoaded) return;

        const topLeft = worldToScreen(-mapImg.naturalWidth / 2, -mapImg.naturalHeight / 2);
        const drawW = mapImg.naturalWidth * cam.zoom;
        const drawH = mapImg.naturalHeight * cam.zoom;

        ctx.drawImage(mapImg, topLeft.x, topLeft.y, drawW, drawH);

        ctx.fillStyle = 'rgba(7, 10, 18, 0.22)';
        ctx.fillRect(0, 0, width, height);
    }

    function drawChakraPulses() {
        routes.forEach(([fromId, toId], idx) => {
            const a = getLocationById(fromId);
            const b = getLocationById(toId);
            if (!a || !b) return;

            const p1 = worldToScreen(a.x, a.y);
            const p2 = worldToScreen(b.x, b.y);

            const t = ((pulsePhase * 0.32 + idx * 0.19) % 1 + 1) % 1;
            const px = p1.x + (p2.x - p1.x) * t;
            const py = p1.y + (p2.y - p1.y) * t;

            ctx.beginPath();
            ctx.arc(px, py, 3.2 * cam.zoom, 0, Math.PI * 2);
            ctx.fillStyle = '#22D3EE';
            ctx.fill();
        });
    }

    function drawPins() {
        locations.forEach((loc) => {
            const p = worldToScreen(loc.x, loc.y);
            const isHovered = hoveredLoc && hoveredLoc.id === loc.id;
            const pulse = 1 + Math.sin(pulsePhase * 3 + loc.x * 0.01) * 0.14;
            const r = (isHovered ? 24 : 19) * cam.zoom;

            ctx.beginPath();
            ctx.arc(p.x, p.y, r * 1.45 * pulse, 0, Math.PI * 2);
            ctx.fillStyle = loc.color + '29';
            ctx.fill();

            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(11, 16, 30, 0.92)';
            ctx.fill();
            ctx.lineWidth = isHovered ? 3 : 2;
            ctx.strokeStyle = loc.color;
            ctx.stroke();

            ctx.font = `${Math.round(14 * cam.zoom)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(loc.icon, p.x, p.y + 1);

            const titleText = loc.label;
            ctx.font = `700 ${Math.round(11 * cam.zoom)}px "Space Grotesk", sans-serif`;
            const textW = ctx.measureText(titleText).width + 14 * cam.zoom;
            const pillH = 18 * cam.zoom;
            const pillY = p.y + r + 6 * cam.zoom;

            ctx.fillStyle = 'rgba(7, 10, 18, 0.86)';
            ctx.fillRect(p.x - textW / 2, pillY, textW, pillH);
            ctx.strokeStyle = loc.color + '88';
            ctx.lineWidth = 1;
            ctx.strokeRect(p.x - textW / 2, pillY, textW, pillH);

            ctx.fillStyle = '#F8FAFC';
            ctx.fillText(titleText, p.x, pillY + pillH / 2 + 0.5);
        });
    }

    function render() {
        pulsePhase += 0.016;
        cam.x += (cam.targetX - cam.x) * 0.09;
        cam.y += (cam.targetY - cam.y) * 0.09;
        cam.zoom += (cam.targetZoom - cam.zoom) * 0.09;

        ctx.clearRect(0, 0, width, height);
        drawMapImage();
        drawChakraPulses();
        drawPins();

        requestAnimationFrame(render);
    }

    render();
})();