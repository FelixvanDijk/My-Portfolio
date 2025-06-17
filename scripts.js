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

        if (projectsButton) {
            projectsButton.addEventListener('click', () => {
                const projectsSection = document.getElementById('projects');
                if (projectsSection) {
                    projectsSection.scrollIntoView({ behavior: 'smooth' });
                }
            });
        }
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
    if (!form) return; // exit if no contact form on current page

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

// Handle business contact form submission
document.addEventListener('DOMContentLoaded', function() {
    const businessForm = document.getElementById('business-contact-form');
    if (!businessForm) return; // exit if no business contact form on current page

    businessForm.addEventListener('submit', function(event) {
        event.preventDefault();
        
        const formData = new FormData(businessForm);
        
        fetch(businessForm.action, {
            method: 'POST',
            body: formData,
            headers: {
                'Accept': 'application/json'
            }
        }).then(response => {
            if (response.ok) {
                alert('Thank you for your inquiry. We will get back to you soon!');
                businessForm.reset();
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
    if (!navbar) return; // SAFETY: abort if page has no navbar
    let shouldShowNavbar = false;

    entries.forEach((entry) => {
        // Show navbar when not on hero/home section
        if (entry.target.id !== 'home' && entry.target.id !== 'hero' && entry.isIntersecting) {
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
    const isBusinessPage = document.querySelector('#hero') !== null; // detect business page
    
    // Add business-page class to body for theme detection
    if (isBusinessPage) {
        document.body.classList.add('business-page');
    } else {
        document.body.classList.remove('business-page');
    }
    
    navLinks.forEach(link => {
        if (link.getAttribute('href') === `#${sectionId}`) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
    
    // Apply blue theme styling for business page
    if (isBusinessPage) {
        const navbar = document.getElementById('navbar');
        if (navbar) {
            // Update pseudo-element colors via CSS injection for blue underlines only
            const style = document.createElement('style');
            style.textContent = `
                #navbar a::after { background-color: #4a90e2 !important; }
                #navbar a.active::after { background-color: #4a90e2 !important; }
                #navbar a:hover::after { background-color: #4a90e2 !important; }
            `;
            if (!document.querySelector('style[data-business-theme]')) {
                style.setAttribute('data-business-theme', 'true');
                document.head.appendChild(style);
            }
        }
    }
}

// Set up the Intersection Observer
let options = {
    root: null,
    rootMargin: '-20% 0px -80% 0px',
    threshold: 0
};

let observerNav = new IntersectionObserver(navFadeIn, options);

// Observe all sections IF they exist on the page
['#home', '#hero', '#projects', '#about', '#about-me', '#services', '#work', '#testimonials', '#contact'].forEach(selector => {
    const el = document.querySelector(selector);
    if (el) observerNav.observe(el);
});

// Call navFadeIn once on page load to set initial state (only if #home exists)
document.addEventListener('DOMContentLoaded', () => {
    // Set business page class immediately on page load
    const isBusinessPage = document.querySelector('#hero') !== null;
    if (isBusinessPage) {
        document.body.classList.add('business-page');
    } else {
        document.body.classList.remove('business-page');
    }
    
    const homeSection = document.querySelector('#home') || document.querySelector('#hero');
    if (homeSection) {
        navFadeIn([{ isIntersecting: true, target: homeSection }], observerNav);
    }
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

// Testimonials Auto-Scroll Functionality
document.addEventListener('DOMContentLoaded', function() {
    const testimonials = document.querySelectorAll('.testimonial');
    const dots = document.querySelectorAll('.dot');
    let currentTestimonial = 0;
    let testimonialInterval;

    if (testimonials.length === 0) return; // Exit if no testimonials on page

    function showTestimonial(index) {
        // Remove active class from all testimonials and dots
        testimonials.forEach((testimonial, i) => {
            testimonial.classList.remove('active', 'prev');
            if (i === currentTestimonial && i !== index) {
                testimonial.classList.add('prev');
            }
        });
        dots.forEach(dot => dot.classList.remove('active'));

        // Add active class to current testimonial and dot
        testimonials[index].classList.add('active');
        dots[index].classList.add('active');
        
        currentTestimonial = index;
    }

    function nextTestimonial() {
        const next = (currentTestimonial + 1) % testimonials.length;
        showTestimonial(next);
    }

    function startAutoScroll() {
        // Clear any existing interval first to prevent duplicates
        stopAutoScroll();
        testimonialInterval = setInterval(nextTestimonial, 7000); // Change every 7 seconds
    }

    function stopAutoScroll() {
        if (testimonialInterval) {
            clearInterval(testimonialInterval);
        }
    }

    // Add click handlers to dots
    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            stopAutoScroll();
            showTestimonial(index);
            startAutoScroll(); // Restart auto-scroll after manual interaction
        });
    });

    // Pause auto-scroll when user hovers over testimonials
    const testimonialContainer = document.querySelector('.testimonials-container');
    if (testimonialContainer) {
        testimonialContainer.addEventListener('mouseenter', stopAutoScroll);
        testimonialContainer.addEventListener('mouseleave', startAutoScroll);
    }

    // Initialize first testimonial and start auto-scroll
    showTestimonial(0);
    startAutoScroll();
});