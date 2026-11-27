// js/map.js - Full-Viewport Stretched Shinobi Continent Map & Interactive Pins
(() => {
    const canvas = document.getElementById('worldMapCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Normalized coordinates (-0.5 to +0.5) relative to the stretched map width/height
    const locations = [
        { id: 'about',     label: 'Leaf Outpost',  tag: 'HIDDEN LEAF',   nx: -0.02, ny: -0.03, color: '#F97316', icon: '🏯' },
        { id: 'education', label: 'Wits Academy',  tag: 'HIDDEN CLOUD',  nx: -0.03, ny: -0.29, color: '#FBBF24', icon: '🎓' },
        { id: 'skills',    label: 'Chakra Dojo',   tag: 'STONE PEAKS',   nx: -0.25, ny: -0.13, color: '#22D3EE', icon: '🌀' },
        { id: 'awards',    label: 'Hall of Fame',  tag: 'VALLEY OF END', nx:  0.24, ny:  0.18, color: '#A855F7', icon: '📜' },
        { id: 'projects',  label: 'Mission Board', tag: 'HIDDEN SAND',   nx:  0.23, ny: -0.04, color: '#F97316', icon: '🎯' },
        { id: 'contact',   label: 'Summon Shrine', tag: 'HIDDEN MIST',   nx: -0.13, ny:  0.17, color: '#22D3EE', icon: '🦅' }
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
    };

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

    function normToScreen(nx, ny) {
        return {
            x: width * (0.5 + nx),
            y: height * (0.5 + ny)
        };
    }

    function getLocationById(id) {
        return locations.find((l) => l.id === id) || null;
    }

    function findLocationAtScreen(sx, sy) {
        const hitRadius = Math.max(28, Math.min(44, Math.min(width, height) * 0.055));
        for (const loc of locations) {
            const p = normToScreen(loc.nx, loc.ny);
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
            if (typeof onArrived === 'function') {
                onArrived(loc);
            }
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

    function drawMapImage() {
        ctx.fillStyle = '#070A12';
        ctx.fillRect(0, 0, width, height);

        if (!imgLoaded) return;

        // Stretch image to fill the full viewport
        ctx.drawImage(mapImg, 0, 0, width, height);

        // Subtle dark tactical overlay so pins & text stay legible
        ctx.fillStyle = 'rgba(7, 10, 18, 0.22)';
        ctx.fillRect(0, 0, width, height);
    }

    function drawChakraPulses() {
        const dotR = Math.max(2.2, Math.min(4, Math.min(width, height) * 0.004));

        routes.forEach(([fromId, toId], idx) => {
            const a = getLocationById(fromId);
            const b = getLocationById(toId);
            if (!a || !b) return;

            const p1 = normToScreen(a.nx, a.ny);
            const p2 = normToScreen(b.nx, b.ny);

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
        const baseR = Math.max(15, Math.min(22, Math.min(width, height) * 0.026));

        locations.forEach((loc) => {
            const p = normToScreen(loc.nx, loc.ny);
            const isHovered = hoveredLoc && hoveredLoc.id === loc.id;
            const pulse = 1 + Math.sin(pulsePhase * 3 + loc.nx * 10) * 0.14;
            const r = isHovered ? baseR * 1.2 : baseR;

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

            ctx.font = `${Math.round(r * 0.72)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(loc.icon, p.x, p.y + 1);

            const fontSize = Math.max(10, Math.min(12, Math.round(r * 0.58)));
            ctx.font = `700 ${fontSize}px "Space Grotesk", sans-serif`;
            const textW = ctx.measureText(loc.label).width + 12;
            const pillH = fontSize + 7;
            const pillY = p.y + r + 5;

            ctx.fillStyle = 'rgba(7, 10, 18, 0.88)';
            ctx.fillRect(p.x - textW / 2, pillY, textW, pillH);
            ctx.strokeStyle = loc.color + '88';
            ctx.lineWidth = 1;
            ctx.strokeRect(p.x - textW / 2, pillY, textW, pillH);

            ctx.fillStyle = '#F8FAFC';
            ctx.fillText(loc.label, p.x, pillY + pillH / 2 + 0.5);
        });
    }

    function render() {
        pulsePhase += 0.016;
        ctx.clearRect(0, 0, width, height);

        drawMapImage();
        drawChakraPulses();
        drawPins();

        requestAnimationFrame(render);
    }

    render();
})();