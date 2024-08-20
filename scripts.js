const canvas = document.getElementById('backgroundCanvas');
const ctx = canvas.getContext('2d');

let width, height;
let particles = [];

// Update the canvas size to the window size
function updateCanvasSize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
}

// Create particles with specific colors
function createParticles() {
    particles = [];
    const colors = ['#FF0000', '#0000FF', '#FFFFFF']; // Red, Blue, White

    for (let i = 0; i < 100; i++) {
        particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            radius: Math.random() * 2 + 1,
            color: colors[Math.floor(Math.random() * colors.length)],
            dx: (Math.random() - 0.5) * 2,
            dy: (Math.random() - 0.5) * 2
        });
    }
}

// Draw and animate particles
function animateParticles() {
    ctx.clearRect(0, 0, width, height);

    particles.forEach(p => {
        p.x += p.dx;
        p.y += p.dy;

        if (p.x < 0 || p.x > width) p.dx *= -1;
        if (p.y < 0 || p.y > height) p.dy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
    });

    requestAnimationFrame(animateParticles);
}

// Initialize everything
function init() {
    updateCanvasSize();
    createParticles();
    animateParticles();
}

window.addEventListener('resize', updateCanvasSize);
window.addEventListener('load', init);
