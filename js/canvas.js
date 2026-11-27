// js/canvas.js - Naruto/Shinobi Tactical Neural Node Canvas
const canvas = document.getElementById('nodeCanvas');
const ctx = canvas.getContext('2d');

let width = 0;
let height = 0;
let particles = [];

const isMobile = window.innerWidth < 768;
const particleCount = isMobile ? 25 : 45;
const maxNodeDistance = isMobile ? 90 : 125;
const maxMouseDistance = 120;

const mouse = {
    x: null,
    y: null
};

// Chakra color palette: Orange, Cyan, Violet
const chakraColors = [
    { r: 249, g: 115, b: 22 },  // Kurama / Chakra Amber-Orange (#F97316)
    { r: 34,  g: 211, b: 238 }, // Chidori Cyan (#22D3EE)
    { r: 168, g: 85,  b: 247 }  // Sharinghan Violet (#A855F7)
];

function resizeCanvas() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
}

window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', resizeCanvas);
resizeCanvas();

window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

window.addEventListener('mouseleave', () => {
    mouse.x = null;
    mouse.y = null;
});

class Particle {
    constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.9;
        this.vy = (Math.random() - 0.5) * 0.9;
        this.radius = Math.random() * 1.8 + 1;
        this.color = chakraColors[Math.floor(Math.random() * chakraColors.length)];
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0 || this.x > width) this.vx *= -1;
        if (this.y < 0 || this.y > height) this.vy *= -1;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0.85)`;
        ctx.fill();
    }
}

function initParticles() {
    particles = [];
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }
}
initParticles();

function animate() {
    ctx.clearRect(0, 0, width, height);

    // Draw particle connections
    for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();

        for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < maxNodeDistance) {
                const alpha = (1 - dist / maxNodeDistance) * 0.35;
                ctx.beginPath();
                ctx.moveTo(particles[i].x, particles[i].y);
                ctx.lineTo(particles[j].x, particles[j].y);
                ctx.strokeStyle = `rgba(${particles[i].color.r}, ${particles[i].color.g}, ${particles[i].color.b}, ${alpha})`;
                ctx.lineWidth = 0.8;
                ctx.stroke();
            }
        }

        // Interactive mouse connection
        if (mouse.x !== null && mouse.y !== null) {
            const mdx = particles[i].x - mouse.x;
            const mdy = particles[i].y - mouse.y;
            const mdist = Math.sqrt(mdx * mdx + mdy * mdy);

            if (mdist < maxMouseDistance) {
                const alpha = (1 - mdist / maxMouseDistance) * 0.5;
                ctx.beginPath();
                ctx.moveTo(particles[i].x, particles[i].y);
                ctx.lineTo(mouse.x, mouse.y);
                ctx.strokeStyle = `rgba(249, 115, 22, ${alpha})`;
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
    }

    requestAnimationFrame(animate);
}

animate();