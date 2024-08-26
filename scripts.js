const canvasDots = function () {
    const canvas = document.querySelector('canvas'),
        ctx = canvas.getContext('2d'),
        colorDot = ['#0000FF', '#0000FF', '#FF0000', '#FFFFFF'];

    // Set canvas dimensions and properties
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.display = 'block';
    ctx.lineWidth = 0.3;
    ctx.strokeStyle = 'rgba(0, 0, 255, 0.5)';
    canvas.style.zIndex = '1'; // Ensure canvas is below other elements

    let mousePosition = {
        x: (30 * canvas.width) / 100,
        y: (30 * canvas.height) / 100,
    };

    const windowSize = window.innerWidth;
    let dots;

    // Define different dot settings based on window width
    if (windowSize > 1600) {
        dots = {
            nb: 600,
            distance: 70,
            d_radius: 300,
            array: [],
        };
    } else if (windowSize > 1300) {
        dots = {
            nb: 575,
            distance: 60,
            d_radius: 280,
            array: [],
        };
    } else {
        dots = {
            nb: 300,
            distance: 60,
            d_radius: 200,
            array: [],
        };
    }

    // Dot constructor function
    function Dot() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = -0.5 + Math.random();
        this.vy = -0.5 + Math.random();
        this.radius = Math.random() * 1.0 + 0.5;
        this.color = colorDot[Math.floor(Math.random() * colorDot.length)];
    }

    // Define Dot prototype methods
    Dot.prototype = {
        create: function () {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
            ctx.fillStyle = this.color;
            ctx.fill();
        },
        animate: function () {
            if (this.y < 0 || this.y > canvas.height) {
                this.vx = this.vx;
                this.vy = -this.vy;
            }
            if (this.x < 0 || this.x > canvas.width) {
                this.vx = -this.vx;
                this.vy = this.vy;
            }
            this.x += this.vx;
            this.y += this.vy;
        },
        drawLine: function () {
            for (let i = 0; i < dots.nb; i++) {
                const dot = dots.array[i];
                if ((dot.x - this.x) < dots.distance && (dot.y - this.y) < dots.distance && (dot.x - this.x) > -dots.distance && (dot.y - this.y) > -dots.distance) {
                    if ((dot.x - mousePosition.x) < dots.d_radius && (dot.y - mousePosition.y) < dots.d_radius && (dot.x - mousePosition.x) > -dots.d_radius && (dot.y - mousePosition.y) > -dots.d_radius) {
                        ctx.beginPath();
                        ctx.moveTo(this.x, this.y);
                        ctx.lineTo(dot.x, dot.y);
                        ctx.strokeStyle = 'rgba(0,0,255,0.1)';
                        ctx.stroke();
                        ctx.closePath();
                    }
                }
            }
        }
    };

    // Create dots and initialize them
    function createDots() {
        for (let i = 0; i < dots.nb; i++) {
            dots.array.push(new Dot());
        }
    }

    // Draw dots on the canvas
    function drawDots() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < dots.nb; i++) {
            const dot = dots.array[i];
            dot.create();
            dot.animate();
            dot.drawLine();
        }
    }

    // Initialize the animation loop for dots
    function init() {
        createDots();
        animateDots();
    }

    function animateDots() {
        drawDots();
        requestAnimationFrame(animateDots);
    }

    // Update mouse position on mouse move
    window.onmousemove = function (e) {
        mousePosition.x = e.pageX;
        mousePosition.y = e.pageY;
    };

    // Handle window resize
    window.onresize = function () {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        dots.array = [];
        createDots();
    };

    // Start animation when the window is loaded
    window.addEventListener('load', () => {
        init();
        const introContainer = document.querySelector('.intro-text-container');

        // Center the intro text container
        introContainer.style.top = `${window.innerHeight / 2 - introContainer.offsetHeight / 2}px`;
        introContainer.style.left = `${window.innerWidth / 2 - introContainer.offsetWidth / 2}px`;
    });
};

// Initialize the canvas dots effect
canvasDots();

// Function to navigate between sections without reloading the page
function navigateToSection(sectionId) {
    // Hide all sections
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => {
        section.classList.add('hidden');
        section.classList.remove('active');
    });

    // Show the selected section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.remove('hidden');
        targetSection.classList.add('active');

        // Scroll to the top of the section
        targetSection.scrollIntoView({ behavior: 'smooth' });
    }
}

// Automatically display the home section on initial load
document.addEventListener('DOMContentLoaded', () => {
    navigateToSection('home');
});
