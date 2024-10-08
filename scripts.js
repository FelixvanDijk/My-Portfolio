const canvasDots = function () {
    const canvas = document.querySelector('.connecting-dots'),
        ctx = canvas.getContext('2d'),
        colorDot = ['#0000FF', '#0000FF', '#FF0000', '#FFFFFF'];

    function setCanvasSize() {
        canvas.width = window.innerWidth - 20; // Subtract scrollbar width
        canvas.height = window.innerHeight;
    }

    setCanvasSize();
    canvas.style.display = 'block';
    canvas.style.position = 'fixed'; // Change to fixed
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.zIndex = '-1'; // Ensure it's behind other content

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
            nb: 800, // Increased from 600
            distance: 70,
            d_radius: 300,
            array: [],
        };
    } else if (windowSize > 1300) {
        dots = {
            nb: 700, // Increased from 575
            distance: 60,
            d_radius: 280,
            array: [],
        };
    } else {
        dots = {
            nb: 500, // Increased from 300
            distance: 60,
            d_radius: 200,
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
                        ctx.strokeStyle = 'rgba(0, 0, 255, 0.1)'; // Reverted to original color
                        ctx.stroke();
                        ctx.closePath();
                    }
                }
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

    function drawDots() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < dots.nb; i++) {
            const dot = dots.array[i];
            dot.create();
            dot.animate();
            dot.drawLine();
        }
    }

    function init() {
        createDots();
        setInterval(() => {
            drawDots();
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
        setCanvasSize();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        dots.array = [];
        createDots();
    };

    window.addEventListener('load', () => {
        const introContainer = document.querySelector('.intro-text-container');
        const projectsButton = document.querySelector('.projects-button');

        // Resize canvas to cover the entire window
        function resizeCanvas() {
            setCanvasSize();
        }

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        projectsButton.addEventListener('click', () => {
            document.getElementById('projects').scrollIntoView({ behavior: 'smooth' });
        });
    });

    // Initialize the canvas dots effect
    init();
};

// Call the function to set up the canvas dots and animations
canvasDots();

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// Handle form submission
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('contact-form');
    
    form.addEventListener('submit', function(event) {
        event.preventDefault();
        
        const formData = new FormData(form);
        
        fetch(form.action, {
            method: 'POST',
            body: formData,
            headers: {
                'Accept': 'application/json'
            }
        }).then(response => {
            if (response.ok) {
                alert('Thank you for your message. I will get back to you soon!');
                form.reset();
            } else {
                response.json().then(data => {
                    if (Object.hasOwn(data, 'errors')) {
                        alert(data["errors"].map(error => error["message"]).join(", "));
                    } else {
                        alert("Oops! There was a problem submitting your form");
                    }
                })
            }
        }).catch(error => {
            alert("Oops! There was a problem submitting your form");
        });
    });
});

// Add this function to handle navbar visibility
function navFadeIn(entries, observer) {
    const navbar = document.getElementById('navbar');
    let shouldShowNavbar = false;

    entries.forEach((entry) => {
        if (entry.target.id !== 'home' && entry.isIntersecting) {
            shouldShowNavbar = true;
        }
        
        if (entry.isIntersecting) {
            updateActiveLink(entry.target.id);
        }
    });

    if (shouldShowNavbar) {
        navbar.classList.add('visible');
    } else {
        navbar.classList.remove('visible');
    }
}

function updateActiveLink(sectionId) {
    const navLinks = document.querySelectorAll('#navbar a');
    navLinks.forEach(link => {
        if (link.getAttribute('href') === `#${sectionId}`) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// Set up the Intersection Observer
let options = {
    root: null,
    rootMargin: '-20% 0px -80% 0px',
    threshold: 0
};

let observerNav = new IntersectionObserver(navFadeIn, options);

// Observe all sections
observerNav.observe(document.querySelector('#home'));
observerNav.observe(document.querySelector('#projects'));
observerNav.observe(document.querySelector('#about-me'));
observerNav.observe(document.querySelector('#contact'));

// Call navFadeIn once on page load to set initial state
document.addEventListener('DOMContentLoaded', () => {
    navFadeIn([{ isIntersecting: true, target: document.querySelector('#home') }], observerNav);
});

// Remove any old event listeners if they exist
if (typeof toggleNavbar === 'function') {
    window.removeEventListener('scroll', toggleNavbar);
    document.removeEventListener('DOMContentLoaded', toggleNavbar);
}

// Smooth scrolling for navigation links
document.addEventListener('DOMContentLoaded', function() {
    // Existing code (if any) ...

    // Smooth scrolling for navigation links
    document.querySelectorAll('#navbar a, .projects-button').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Smooth scrolling for "Back to Top" button
    document.addEventListener('DOMContentLoaded', function() {
        const backToTopButton = document.querySelector('#back-to-top');
        
        if (backToTopButton) {
            backToTopButton.addEventListener('click', function(e) {
                e.preventDefault();
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            });
        }
    });
});