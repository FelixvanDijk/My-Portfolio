function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

const canvasDots = function () {
    const canvas = document.querySelector('canvas'),
        ctx = canvas.getContext('2d'),
        colorDot = ['#0000FF', '#0000FF', '#FF0000', '#FFFFFF'], // Blue, Red, White
        color = 'rgba(0, 0, 255, 0.5)'; // Default line color if needed (more transparent blue)

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.display = 'block';
    ctx.lineWidth = 0.3;
    ctx.strokeStyle = color;

    let mousePosition = {
        x: (30 * canvas.width) / 100,
        y: (30 * canvas.height) / 100,
    };

    const windowSize = window.innerWidth;
    let dots;

    if (windowSize > 1600) {
        dots = {
            nb: 600, // Number of particles
            distance: 70, // Max distance between particles for linking
            d_radius: 300, // Radius from mouse where particles will link
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
        this.radius = Math.random() * 1.0 + 0.5; // Smaller maximum radius
        this.color = colorDot[Math.floor(Math.random() * colorDot.length)];
    }

    Dot.prototype = {
        create: function () {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
            ctx.fillStyle = this.color;
            ctx.globalAlpha = 0.6; // Set transparency of the dots
            ctx.fill();
            ctx.globalAlpha = 1.0; // Reset transparency for future drawing
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
        dots.array[0].radius = 1.0; // Smaller radius for the first dot
        dots.array[0].color = 'rgba(81, 162, 233, 0.8)'; // Slightly transparent blue
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

    // Add the text positioning and resizing logic
    window.addEventListener('load', () => {
        const introContainer = document.querySelector('.intro-text-container');
        const canvas = document.querySelector('canvas');

        // Set the text container to be centered
        introContainer.style.top = `${window.innerHeight / 2 - introContainer.offsetHeight / 2}px`;
        introContainer.style.left = `${window.innerWidth / 2 - introContainer.offsetWidth / 2}px`;
        
        // Adjust canvas size
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        
        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
    });
};

canvasDots();
