const canvasDots = function () {
    const canvas = document.querySelector('.connecting-dots'),
        ctx = canvas.getContext('2d'),
        colorDot = ['#0000FF', '#0000FF', '#FF0000', '#FFFFFF'];

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.display = 'block';
    ctx.lineWidth = 0.4;
    ctx.strokeStyle = 'rgba(100, 100, 255, 0.7)';

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
            ctx.globalAlpha = 0.6;
            ctx.fill();
            ctx.globalAlpha = 1.0;
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
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < dots.nb; i++) {
            dots.array.push(new Dot());
            const dot = dots.array[i];
            dot.create();
        }
        dots.array[0].radius = 1.0;
        dots.array[0].color = 'rgba(81, 162, 233, 0.8)';
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
        setInterval(() => {
            drawDots();
        }, 1000 / 30);
    }

    // Update mouse position on mouse move
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

    // Handle window resize
    window.onresize = function () {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        dots.array = [];
        createDots();
    };

    // Adjust text container position on window resize and load
    window.addEventListener('load', () => {
        const introContainer = document.querySelector('.intro-text-container');

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

    init();
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

        // Scroll to the top of the section smoothly
        targetSection.scrollIntoView({ behavior: 'smooth' });
    }
}

// Automatically display the home section on initial load
document.addEventListener('DOMContentLoaded', () => {
    navigateToSection('home');
});

// Handle form submission
document.getElementById('contact-form').addEventListener('submit', function(event) {
    event.preventDefault(); // Prevent the default form submission behavior

    // Extract form data
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const message = document.getElementById('message').value;

    // Here, you can implement form submission logic, such as sending the data to a server
    console.log('Form submitted with:', { name, email, message });

    // For now, we'll just display a simple alert
    alert('Thank you for contacting me, ' + name + '! I will get back to you soon.');

    // Reset form fields
    document.getElementById('contact-form').reset();
});
