

const canvasDots = function () {
    const canvas = document.querySelector('canvas'),
        ctx = canvas.getContext('2d'),
        colorDot = ['#0000FF', '#0000FF', '#FF0000', '#FFFFFF'];

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.display = 'block';
    ctx.lineWidth = 0.3;
    ctx.strokeStyle = 'rgba(0, 0, 255, 0.5)';

    let mousePosition = {
        x: (30 * canvas.width) / 100,
        y: (30 * canvas.height) / 100,
    };

    const windowSize = window.innerWidth;
    let dots;

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
            distance: 0,
            d_radius: 0,
            array: [],
        };
    }

    function Dot() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = -0.5 + Math.random();
        this.vy = -0.5 + Math.random();
        this.radius = Math.random() * 1.0 + 0.5;
        this.color = colorDot[Math.floor(Math.random() * colorDot.length)];
    }

    Dot.prototype = {
        create: function () {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
            ctx.fillStyle = this.color;
            ctx.globalAlpha = 0.6;
            ctx.fill();
            ctx.globalAlpha = 1.0;
        },
        animate: function () {
            for (let i = 0; i < dots.nb; i++) {
                const dot = dots.array[i];
                if (dot.y < 0 || dot.y > canvas.height) {
                    dot.vx = dot.vx;
                    dot.vy = -dot.vy;
                } else if (dot.x < 0 || dot.x > canvas.width) {
                    dot.vx = -dot.vx;
                    dot.vy = dot.vy;
                }
                dot.x += dot.vx;
                dot.y += dot.vy;
            }
        }
    };

    function createDots() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < dots.nb; i++) {
            dots.array.push(new Dot());
            const dot = dots.array[i];
            dot.create();
        }
        dots.array[0].radius = 1.0;
        dots.array[0].color = 'rgba(81, 162, 233, 0.8)';
    }

    function init() {
        createDots();
        setInterval(() => {
            createDots();
            dots.array[0].animate();
        }, 1000 / 30);
    }

    window.onmousemove = function (e) {
        mousePosition.x = e.pageX;
        mousePosition.y = e.pageY;
        try {
            dots.array[0].x = e.pageX;
            dots.array[0].y = e.pageY;
        } catch (error) {
            console.log(error);
        }
    };

    window.onresize = function () {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        dots.array = [];
        createDots();
    };

    init();

    // Adjust text container position on window resize and load
    window.addEventListener('load', () => {
        const introContainer = document.querySelector('.intro-text-container');
        const canvas = document.querySelector('canvas');

        // Center the intro text container
        introContainer.style.top = `${window.innerHeight / 2 - introContainer.offsetHeight / 2}px`;
        introContainer.style.left = `${window.innerWidth / 2 - introContainer.offsetWidth / 2}px`;

        // Resize canvas to cover the entire window
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
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


