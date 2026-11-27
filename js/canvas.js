// js/canvas.js
const canvas = document.getElementById('nodeCanvas');
const ctx = canvas.getContext('2d');

let width = 0;
let height = 0;
let particles = [];

const particleCount = 45;
const maxNodeDistance = 125;
const maxMouseDistance = 150;

const mouse = {
    x: null,
    y: null
};

// Keep canvas dimensions matched to the browser window
function resizeCanvas() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Track cursor position for interactive connections
window.addEventListener('mousemove', (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
});

window.addEventListener('mouseleave', () => {
    mouse.x = null;
    mouse.y = null;
});

class NodeParticle {
    constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.55;
        this.vy = (Math.random() - 0.5) * 0.55;
        this.radius = Math.random() * 1.5 + 1.5;
        // Alternate slightly between cyan and violet nodes
        this.color = Math.random() > 0.25 ? '#06B6D4' : '#8B5CF6';
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;

        // Bounce off left/right and top/bottom edges
        if (this.x < 0 || this.x > width) {
            this.vx *= -1;
        }
        if (this.y < 0 || this.y > height) {
            this.vy *= -1;
        }
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
    }
}

function initParticles() {
    particles = [];
    for (let i = 0; i < particleCount; i++) {
        particles.push(new NodeParticle());
    }
}

function drawConnections() {
    for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];

        // Connect nearby nodes to each other
        for (let j = i + 1; j < particles.length; j++) {
            const p2 = particles[j];
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            const distance = Math.hypot(dx, dy);

            if (distance < maxNodeDistance) {
                const alpha = (1 - distance / maxNodeDistance) * 0.65;
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.strokeStyle = `rgba(6, 182, 212, ${alpha.toFixed(3)})`;
                ctx.lineWidth = 0.7;
                ctx.stroke();
            }
        }

        // Connect nearby nodes to the mouse cursor
        if (mouse.x !== null && mouse.y !== null) {
            const mdx = p1.x - mouse.x;
            const mdy = p1.y - mouse.y;
            const mouseDistance = Math.hypot(mdx, mdy);

            if (mouseDistance < maxMouseDistance) {
                const alpha = (1 - mouseDistance / maxMouseDistance) * 0.8;
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(mouse.x, mouse.y);
                ctx.strokeStyle = `rgba(139, 92, 246, ${alpha.toFixed(3)})`;
                ctx.lineWidth = 0.9;
                ctx.stroke();
            }
        }
    }
}

function animate() {
    ctx.clearRect(0, 0, width, height);

    for (const particle of particles) {
        particle.update();
        particle.draw();
    }

    drawConnections();
    requestAnimationFrame(animate);
}

initParticles();
animate();