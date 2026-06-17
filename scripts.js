/* ============================================================
   felix.c — runtime
   Lenis smooth scroll · GSAP ScrollTrigger choreography
   canvas "memory space" · program counter · easter eggs
   ============================================================ */

(function () {
    'use strict';

    var docEl = document.documentElement;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
    var hasLenis = typeof window.Lenis !== 'undefined';

    if (hasGsap) {
        gsap.registerPlugin(ScrollTrigger);
        if (window.ScrollToPlugin) gsap.registerPlugin(ScrollToPlugin);
    } else {
        docEl.classList.add('no-anim', 'no-canvas');
    }

    /* sections are discovered from the page, so this runtime powers
       both felix.c (personal) and fvandijk.ltd (business) */
    var sectionNodes = Array.prototype.slice.call(document.querySelectorAll('#main .section[id]'));
    var SECTIONS = sectionNodes.map(function (s) { return s.id; });
    var SECTION_LN = {};
    sectionNodes.forEach(function (s) { SECTION_LN[s.id] = s.getAttribute('data-ln') || '001'; });
    var IS_BIZ = document.body.classList.contains('theme-biz');
    var EMAIL = IS_BIZ ? 'outreach@felixvandijk.dev' : 'felixvandijkk@gmail.com';

    /* ---------- tiny helpers ---------- */
    function $(sel, root) { return (root || document).querySelector(sel); }
    function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
    function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
    function inField() {
        var el = document.activeElement;
        return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    }

    function toast(msg, isErr, ms) {
        var wrap = $('#toasts');
        if (!wrap) return;
        var t = document.createElement('div');
        t.className = 'toast' + (isErr ? ' toast-err' : '');
        t.textContent = msg;
        wrap.appendChild(t);
        setTimeout(function () {
            t.classList.add('toast-out');
            setTimeout(function () { t.remove(); }, 350);
        }, ms || 3200);
    }

    /* ============================================================
       SMOOTH SCROLL (Lenis) + anchor handling
       ============================================================ */
    var lenis = null;
    if (hasLenis && hasGsap && !reduceMotion) {
        lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1 });
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
        gsap.ticker.lagSmoothing(0);
    } else {
        docEl.style.scrollBehavior = reduceMotion ? 'auto' : 'smooth';
    }

    function scrollToY(y) {
        if (lenis) lenis.scrollTo(y, { duration: 1.1, easing: function (t) { return 1 - Math.pow(1 - t, 4); } });
        else window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
    }

    function scrollToEl(el) {
        if (!el) return;
        var y = el.getBoundingClientRect().top + window.scrollY - 72;
        if (el.id === 'hero') y = 0;
        scrollToY(Math.max(0, y));
    }

    document.addEventListener('click', function (e) {
        var a = e.target.closest('a[href^="#"]');
        if (!a) return;
        if (a.classList.contains('skip-link')) return; // native jump + focus move
        var id = a.getAttribute('href').slice(1);
        var target = id ? document.getElementById(id) : null;
        if (!target) return;
        e.preventDefault();
        scrollToEl(target);
        closeMobileMenu();
    });

    // deep links (e.g. sub-page → personal.html#projects): re-aim after layout settles
    window.addEventListener('load', function () {
        if (!location.hash) return;
        var target = document.getElementById(location.hash.slice(1));
        if (!target) return;
        setTimeout(function () { scrollToEl(target); }, 150);
    });

    /* ============================================================
       BOOT LOG (non-blocking corner overlay, once per session)
       ============================================================ */
    (function bootLog() {
        var el = $('#boot-log');
        if (!el || reduceMotion) return;
        var done = false;
        try { done = sessionStorage.getItem('booted') === '1'; } catch (err) { /* private mode */ }
        if (done) return;
        var projCount = document.querySelectorAll('.proc-card').length;
        var caseCount = document.querySelectorAll('.case-file').length;
        var lines = [
            'felixvandijk.dev kernel loading… [OK]',
            IS_BIZ ? 'mounting /services … [OK]' : 'mounting /skills … [OK]',
            projCount ? 'fetching projects (' + projCount + ' found) … [OK]'
                      : 'fetching client work (' + caseCount + ' found) … [OK]',
            'starting render…'
        ];
        var i = 0;
        var iv = setInterval(function () {
            if (i >= lines.length) {
                clearInterval(iv);
                setTimeout(function () {
                    el.style.transition = 'opacity 0.5s ease';
                    el.style.opacity = '0';
                    setTimeout(function () { el.remove(); }, 600);
                }, 900);
                try { sessionStorage.setItem('booted', '1'); } catch (err) { /* ignore */ }
                return;
            }
            var line = document.createElement('div');
            var txt = lines[i];
            if (txt.indexOf('[OK]') > -1) {
                line.innerHTML = txt.replace('[OK]', '<span class="ok">[OK]</span>');
            } else {
                line.textContent = txt;
            }
            el.appendChild(line);
            i++;
        }, 260);
    })();

    /* ============================================================
       HERO — typing, then (desktop) printf → headline morph
       ============================================================ */
    var heroTyped = false;
    (function heroTyping() {
        var pre = $('#hero-pre');
        var rendered = $('#hero-rendered');
        if (!pre) return;

        var lines = $all('.ln', pre);

        function finish() {
            lines.forEach(function (l) { l.classList.add('is-typed'); });
            heroTyped = true;
            if (rendered && !docEl.classList.contains('pin-hero')) {
                rendered.classList.add('is-shown');
                revealHeroA11y();
            }
        }

        if (reduceMotion || !document.documentElement.classList.contains('js')) {
            finish();
            return;
        }

        var i = 0;
        var iv = setInterval(function () {
            if (i >= lines.length) { clearInterval(iv); finish(); return; }
            lines[i].classList.add('is-typed');
            i++;
        }, 170);

        function skip() {
            clearInterval(iv);
            finish();
            window.removeEventListener('keydown', skip);
            window.removeEventListener('pointerdown', skip);
        }
        window.addEventListener('keydown', skip, { once: false });
        window.addEventListener('pointerdown', skip, { once: false });
        setTimeout(function () {
            window.removeEventListener('keydown', skip);
            window.removeEventListener('pointerdown', skip);
        }, 2400);
    })();

    /* hero a11y: while the desktop morph hides the rendered hero, a sr-only
       paragraph carries the text; once visible, swap them so nothing reads twice.
       One-way: after the first reveal the hero is never re-hidden from AT. */
    var heroRevealed = false;
    function revealHeroA11y() {
        heroRevealed = true;
        var r = $('#hero-rendered');
        if (r) r.removeAttribute('aria-hidden');
        var sr = $('#hero-sr');
        if (sr) sr.remove();
    }

    /* offset of el relative to ancestor, ignoring transforms */
    function offsetWithin(el, ancestor) {
        var x = 0, y = 0, n = el;
        while (n && n !== ancestor) {
            x += n.offsetLeft;
            y += n.offsetTop;
            n = n.offsetParent;
        }
        return { x: x, y: y };
    }

    /* ============================================================
       SCROLL CHOREOGRAPHY (gsap.matchMedia)
       ============================================================ */
    var procCards = $all('.proc-card');

    function setActiveProcess(idx) {
        $all('.proc-row').forEach(function (row) {
            var i = parseInt(row.dataset.index, 10);
            row.classList.toggle('is-active', i === idx);
            var state = row.querySelector('.proc-state');
            if (state) {
                state.textContent = i < idx ? 'exit 0' : (i === idx ? 'running' : 'queued');
            }
        });
    }

    function scrollToProject(idx) {
        var card = $('#proj-' + idx);
        if (card) scrollToEl(card);
        else scrollToEl($('#projects'));
    }

    function pulseProjectTags(idx) {
        var card = $('#proj-' + idx);
        if (!card) return;
        $all('.proc-tags li', card).forEach(function (li) { li.classList.add('is-hl'); });
        setTimeout(function () {
            $all('.proc-tags li', card).forEach(function (li) { li.classList.remove('is-hl'); });
        }, 2600);
    }

    /* class-based reveal triggers shared by all breakpoints */
    function buildRevealTriggers() {
        // About: uncomment lines one by one
        $all('.doc-line').forEach(function (line, i) {
            ScrollTrigger.create({
                trigger: line,
                start: 'top 70%',
                once: true,
                onEnter: function () {
                    setTimeout(function () { line.classList.add('is-run'); }, i * 220);
                }
            });
        });

        // Skills: package resolve → [OK] → chips cascade
        $all('.pkg-group').forEach(function (group, gi) {
            $all('.chip-list li', group).forEach(function (li, ci) {
                li.style.transitionDelay = (ci * 45) + 'ms';
            });
            ScrollTrigger.create({
                trigger: group,
                start: 'top 78%',
                once: true,
                onEnter: function () {
                    setTimeout(function () { group.classList.add('is-ok'); }, 380 + gi * 120);
                }
            });
        });
        var pkgFooter = $('#pkg-footer');
        if (pkgFooter) {
            ScrollTrigger.create({
                trigger: pkgFooter,
                start: 'top 92%',
                once: true,
                onEnter: function () { pkgFooter.classList.add('is-in'); }
            });
        }

        // Journey: commits pop in
        $all('.commit').forEach(function (c) {
            ScrollTrigger.create({
                trigger: c,
                start: 'top 80%',
                once: true,
                onEnter: function () { c.classList.add('is-in'); }
            });
        });

        // Journey: git line draws with scroll
        var path = $('#git-line-path');
        var svg = $('#git-line-svg');
        if (path && svg) {
            var bg = path.cloneNode();
            bg.id = '';
            bg.classList.add('git-line-bg');
            bg.style.filter = 'none';
            svg.insertBefore(bg, path);
            gsap.set(path, { strokeDasharray: 1000, strokeDashoffset: 1000 });
            gsap.to(path, {
                strokeDashoffset: 0,
                ease: 'none',
                scrollTrigger: {
                    trigger: '.git-graph',
                    start: 'top 75%',
                    end: 'bottom 55%',
                    scrub: reduceMotion ? false : 1
                }
            });
        }
    }

    if (hasGsap && !reduceMotion) {
        buildRevealTriggers();

        var mm = gsap.matchMedia();

        /* ----- desktop: hero pin + printf morph (personal page only) ----- */
        mm.add('(min-width: 1024px)', function () {
            var stage = $('.hero-stage');
            var lit = $('#hero-literal');
            var line1 = $('#h1-line1');
            if (!stage || !lit || !line1) return;

            docEl.classList.add('pin-hero');

            var heroRendered = $('#hero-rendered');
            if (heroRendered && !heroRevealed) heroRendered.setAttribute('aria-hidden', 'true');

            gsap.set(line1, { display: 'inline-block' });

            function delta() {
                var litPos = offsetWithin(lit, stage);
                var tgtPos = offsetWithin(line1, stage);
                var litFs = parseFloat(getComputedStyle(lit).fontSize);
                var tgtFs = parseFloat(getComputedStyle(line1).fontSize);
                return { x: tgtPos.x - litPos.x, y: tgtPos.y - litPos.y, s: tgtFs / litFs };
            }

            var heroTl = gsap.timeline({
                scrollTrigger: {
                    trigger: '#hero',
                    start: 'top top',
                    end: '+=100%',
                    scrub: 0.5,
                    pin: true,
                    anticipatePin: 1,
                    invalidateOnRefresh: true
                }
            });

            heroTl
                .to($all('#hero-pre .tok'), { autoAlpha: 0, y: 26, stagger: 0.012, duration: 0.32, ease: 'power2.in' }, 0)
                .to('#hero-caret', { autoAlpha: 0, duration: 0.08 }, 0)
                .to(lit, {
                    x: function () { return delta().x; },
                    y: function () { return delta().y; },
                    scale: function () { return delta().s; },
                    color: '#F8FAFC',
                    duration: 0.5,
                    ease: 'power3.inOut'
                }, 0.08)
                .to(lit, { autoAlpha: 0, duration: 0.1 }, 0.56)
                .fromTo('#hero-rendered',
                    { autoAlpha: 0 },
                    { autoAlpha: 1, duration: 0.22, onStart: function () {
                        $('#hero-rendered').classList.add('is-shown');
                        revealHeroA11y();
                    } }, 0.52)
                .fromTo('#hero-headline', { y: 8 }, { y: 0, duration: 0.3 }, 0.52)
                .fromTo('.hero-sub', { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.22 }, 0.66)
                .fromTo('.hero-ctas', { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.22 }, 0.76);

            return function () {
                docEl.classList.remove('pin-hero');
                var r = $('#hero-rendered');
                if (r) r.classList.add('is-shown');
                revealHeroA11y();
            };
        });

        /* ----- projects: free-scrolling cards, each "executes" on arrival
               (no pin — the process list scrollspies alongside) ----- */
        procCards.forEach(function (card) {
            gsap.from(card, {
                autoAlpha: 0,
                y: 44,
                duration: 0.7,
                ease: 'power3.out',
                scrollTrigger: { trigger: card, start: 'top 85%', once: true }
            });
            var img = $('.shot-wrap img', card);
            var scan = $('.scanline', card);
            if (img) {
                gsap.fromTo(img, { clipPath: 'inset(0 100% 0 0)' }, {
                    clipPath: 'inset(0 0% 0 0)',
                    duration: 0.7,
                    ease: 'power2.out',
                    scrollTrigger: { trigger: card, start: 'top 70%', once: true }
                });
            }
            if (scan) {
                gsap.fromTo(scan, { left: '0%', opacity: 1 }, {
                    left: '100%',
                    opacity: 0,
                    duration: 0.72,
                    ease: 'power2.out',
                    scrollTrigger: { trigger: card, start: 'top 70%', once: true }
                });
            }
        });

        /* ----- mobile: reveal hero immediately after typing ----- */
        mm.add('(max-width: 1023px)', function () {
            var r = $('#hero-rendered');
            if (r && heroTyped) r.classList.add('is-shown');
        });

        /* subtle parallax on project screenshots (desktop, cheap) */
        mm.add('(min-width: 1024px)', function () {
            $all('.shot-wrap img').forEach(function (img) {
                gsap.fromTo(img, { yPercent: -3 }, {
                    yPercent: 3,
                    ease: 'none',
                    scrollTrigger: { trigger: img.closest('.proc-card'), start: 'top bottom', end: 'bottom top', scrub: 1 }
                });
            });
        });

        // refresh measurements once fonts are in (mono metrics shift)
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
        }
    } else {
        // no animation path: make everything visible/final
        $all('.doc-line').forEach(function (l) { l.classList.add('is-run'); });
        $all('.pkg-group').forEach(function (g) { g.classList.add('is-ok'); });
        var pf = $('#pkg-footer'); if (pf) pf.classList.add('is-in');
        $all('.commit').forEach(function (c) { c.classList.add('is-in'); });
        var hr = $('#hero-rendered'); if (hr) hr.classList.add('is-shown');
        revealHeroA11y();
    }

    /* scroll cue: fade after first real scroll */
    (function cue() {
        var el = $('#scroll-cue');
        if (!el) return;
        var off = function () {
            if (window.scrollY > 60) {
                el.style.transition = 'opacity 0.5s ease';
                el.style.opacity = '0';
                window.removeEventListener('scroll', off);
            }
        };
        window.addEventListener('scroll', off, { passive: true });
    })();

    /* ============================================================
       PROGRAM COUNTER — section states, nav, statusbar, dwell
       ============================================================ */
    var currentSection = 'hero';
    var dwell = {};
    var dwellStart = performance.now();
    var sectionEls = SECTIONS.map(function (id) { return document.getElementById(id); }).filter(Boolean);
    var pcMedia = window.matchMedia('(min-width: 1200px)');
    function syncPcOn() {
        var on = hasGsap && !reduceMotion && pcMedia.matches;
        docEl.classList.toggle('pc-on', on);
        if (!on) sectionEls.forEach(function (s) { s.classList.remove('is-pending'); });
    }
    if (pcMedia.addEventListener) pcMedia.addEventListener('change', syncPcOn);
    syncPcOn();

    var navLinks = $all('#site-nav a');
    var bpLinks = $all('#breakpoints .bp');
    var sbSection = $('#sb-section');
    var sbBuild = $('#sb-build');
    var buildDone = false;
    var lastBuildPct = -1;

    function recordDwell(next) {
        var now = performance.now();
        dwell[currentSection] = (dwell[currentSection] || 0) + (now - dwellStart);
        dwellStart = now;
        currentSection = next;
    }

    var pcTicking = false;
    function pcUpdate() {
        pcTicking = false;
        var caretY = window.innerHeight * 0.38;

        var active = 'hero';
        sectionEls.forEach(function (sec) {
            var top = sec.getBoundingClientRect().top;
            var pending = top > caretY;
            if (docEl.classList.contains('pc-on')) {
                sec.classList.toggle('is-pending', pending);
            }
            if (!pending) active = sec.id;
        });

        if (active !== currentSection) recordDwell(active);

        // process-list scrollspy: highlight the project currently in view
        if (procCards.length) {
            var spyLine = window.innerHeight * 0.45;
            var procIdx = 0;
            procCards.forEach(function (card, i) {
                if (card.getBoundingClientRect().top < spyLine) procIdx = i;
            });
            setActiveProcess(procIdx);
        }

        navLinks.forEach(function (a) {
            a.classList.toggle('is-active', a.dataset.section === active);
        });
        bpLinks.forEach(function (a) {
            a.classList.toggle('is-active', a.dataset.section === active);
        });
        if (sbSection) sbSection.textContent = 'Ln ' + (SECTION_LN[active] || '001') + ' · ' + active;

        // BUILD %
        var doc = document.documentElement;
        var max = doc.scrollHeight - window.innerHeight;
        var pct = max > 0 ? Math.round(clamp(window.scrollY / max, 0, 1) * 100) : 100;
        if (sbBuild && pct !== lastBuildPct) {
            lastBuildPct = pct;
            if (pct >= 100) {
                sbBuild.textContent = 'BUILD 100% ✓';
                if (!buildDone) {
                    buildDone = true;
                    sbBuild.classList.add('build-done');
                }
            } else {
                sbBuild.textContent = 'BUILD ' + pct + '%';
            }
        }
    }

    function onScrollPc() {
        if (!pcTicking) {
            pcTicking = true;
            requestAnimationFrame(pcUpdate);
        }
    }
    window.addEventListener('scroll', onScrollPc, { passive: true });
    window.addEventListener('resize', onScrollPc);
    pcUpdate();

    /* ============================================================
       FOOTER — execution trace (computed locally)
       ============================================================ */
    (function execTrace() {
        var traceEl = $('#exec-trace');
        var footer = $('#footer');
        if (!traceEl || !footer || !('IntersectionObserver' in window)) return;
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                recordDwell(currentSection); // flush current
                var parts = SECTIONS.filter(function (s) { return dwell[s] > 300; }).map(function (s) {
                    return s + ' ' + (dwell[s] / 1000).toFixed(1) + 's';
                });
                traceEl.innerHTML =
                    '$ ./felix --trace\n' +
                    (parts.length ? parts.join(' → ') + '\n' : '') +
                    '<span class="tr-ok">build succeeded</span> · 0 warnings\n' +
                    '// timings computed locally — never sent anywhere';
                io.disconnect();
            });
        }, { threshold: 0.4 });
        io.observe(footer);
    })();

    /* ============================================================
       SKILLS — chip → project cross-link
       ============================================================ */
    $all('.chip[data-project]').forEach(function (chip) {
        chip.addEventListener('click', function () {
            var idx = parseInt(chip.dataset.project, 10);
            chip.classList.add('is-pulse');
            setTimeout(function () { chip.classList.remove('is-pulse'); }, 600);
            scrollToProject(idx);
            setTimeout(function () { pulseProjectTags(idx); }, 1200);
        });
    });

    /* process list rows */
    $all('.proc-row').forEach(function (row) {
        row.addEventListener('click', function () {
            scrollToProject(parseInt(row.dataset.index, 10));
        });
    });

    /* ============================================================
       ABOUT — ID card tilt
       ============================================================ */
    (function cardTilt() {
        var card = $('#id-card');
        if (!card || reduceMotion || !window.matchMedia('(pointer: fine)').matches) return;
        var rx = 0, ry = 0, tx = 0, ty = 0, raf = null;

        function loop() {
            rx += (tx - rx) * 0.1;
            ry += (ty - ry) * 0.1;
            card.style.transform = 'rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)';
            if (Math.abs(tx - rx) > 0.05 || Math.abs(ty - ry) > 0.05) raf = requestAnimationFrame(loop);
            else raf = null;
        }
        function kick() { if (!raf) raf = requestAnimationFrame(loop); }

        card.addEventListener('pointermove', function (e) {
            var r = card.getBoundingClientRect();
            var px = (e.clientX - r.left) / r.width - 0.5;
            var py = (e.clientY - r.top) / r.height - 0.5;
            tx = py * -8;
            ty = px * 8;
            kick();
        });
        card.addEventListener('pointerleave', function () { tx = 0; ty = 0; kick(); });
    })();

    /* ============================================================
       CONTACT — ghost preview, validation, submit, copy email
       ============================================================ */
    (function contactForm() {
        var form = $('#contact-form');
        if (!form) return;

        var fields = {
            name: $('#name'),
            email: $('#email'),
            message: $('#message')
        };
        var ghosts = {
            name: $('#ghost-name'),
            email: $('#ghost-email'),
            message: $('#ghost-message')
        };
        var result = $('#form-result');
        var submitBtn = $('#submit-btn');

        function ghostText(v) {
            var s = v.length > 42 ? v.slice(0, 42) + '…' : v;
            return JSON.stringify(s);
        }
        Object.keys(fields).forEach(function (k) {
            if (!fields[k]) return;
            fields[k].addEventListener('input', function () {
                if (ghosts[k]) ghosts[k].textContent = ghostText(fields[k].value);
                clearError(k);
            });
        });

        function showError(k) {
            var err = $('#' + k + '-error');
            if (err) err.hidden = false;
            if (fields[k]) fields[k].setAttribute('aria-invalid', 'true');
        }
        function clearError(k) {
            var err = $('#' + k + '-error');
            if (err) err.hidden = true;
            if (fields[k]) fields[k].removeAttribute('aria-invalid');
        }

        function validate(k) {
            var v = fields[k].value.trim();
            if (k === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
            return v.length > 0;
        }

        Object.keys(fields).forEach(function (k) {
            if (!fields[k]) return;
            fields[k].addEventListener('blur', function () {
                if (fields[k].value.trim() === '') return; // don't nag empty on blur
                validate(k) ? clearError(k) : showError(k);
            });
        });

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var bad = Object.keys(fields).filter(function (k) { return !validate(k); });
            if (bad.length) {
                bad.forEach(showError);
                fields[bad[0]].focus();
                return;
            }

            submitBtn.classList.add('is-busy');
            result.className = 'form-result mono';
            result.textContent = 'compiling message…';

            fetch(form.action, {
                method: 'POST',
                body: new FormData(form),
                headers: { 'Accept': 'application/json' }
            }).then(function (res) {
                submitBtn.classList.remove('is-busy');
                if (res.ok) {
                    result.className = 'form-result mono ok';
                    result.textContent = '=> { status: 200, body: "Thanks — I\'ll get back to you soon." }';
                    form.reset();
                    Object.keys(ghosts).forEach(function (k) { if (ghosts[k]) ghosts[k].textContent = '""'; });
                } else {
                    throw new Error('status ' + res.status);
                }
            }).catch(function () {
                submitBtn.classList.remove('is-busy');
                result.className = 'form-result mono err';
                result.innerHTML = '=> { status: 500 } — something broke. Try again, or <a href="mailto:' + EMAIL + '">email me directly</a>.';
            });
        });

        // copy email
        var copyBtn = $('#copy-email');
        if (copyBtn) {
            copyBtn.addEventListener('click', function () {
                var ok = function () {
                    copyBtn.textContent = 'copied ✓';
                    copyBtn.classList.add('is-copied');
                    toast(EMAIL + ' → clipboard');
                    setTimeout(function () {
                        copyBtn.textContent = 'copy';
                        copyBtn.classList.remove('is-copied');
                    }, 2200);
                };
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(EMAIL).then(ok, function () { toast('copy failed — ' + EMAIL, true); });
                } else {
                    toast(EMAIL, false, 5000);
                }
            });
        }
    })();

    /* ============================================================
       MOBILE MENU
       ============================================================ */
    var menuBtn = $('#menu-btn');
    var mobileMenu = $('#mobile-menu');

    function closeMobileMenu() {
        if (!mobileMenu || mobileMenu.hidden) return;
        mobileMenu.hidden = true;
        if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
    }
    if (menuBtn && mobileMenu) {
        var lastMenuToggle = 0;
        menuBtn.addEventListener('click', function () {
            var now = Date.now();
            if (now - lastMenuToggle < 250) return; // debounce double-fired taps
            lastMenuToggle = now;
            var open = mobileMenu.hidden;
            mobileMenu.hidden = !open;
            menuBtn.setAttribute('aria-expanded', String(open));
            menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
            document.body.style.overflow = open ? 'hidden' : '';
        });
    }

    /* ============================================================
       COMMAND PALETTE
       ============================================================ */
    (function palette() {
        var overlay = $('#palette');
        var input = $('#palette-input');
        var list = $('#palette-list');
        var btn = $('#palette-btn');
        if (!overlay || !input || !list) return;

        var lastFocus = null;
        var selIdx = 0;
        var visible = [];
        var openedAt = 0;

        function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
        var commands = SECTIONS.filter(function (id) { return id !== 'hero'; }).map(function (id) {
            return { label: 'Go to ' + cap(id), kind: 'goto', run: function () {
                scrollToEl(document.getElementById(id));
            } };
        });
        commands.push(
            IS_BIZ
                ? { label: 'Switch to personal side (felix.c)', kind: 'goto', run: function () { window.location.href = 'personal.html'; } }
                : { label: 'Switch to business side (F van Dijk Ltd)', kind: 'goto', run: function () { window.location.href = 'business.html'; } },
            { label: 'Project: The Gathouse Vets', kind: 'proj', run: function () { if (IS_BIZ) window.location.href = 'personal.html#projects'; else scrollToProject(0); } },
            { label: 'Project: Consultant (live preview)', kind: 'proj', run: function () { window.open('https://felixvandijk.github.io/JanConsultancy/', '_blank', 'noopener'); } },
            { label: 'Project: Scotland Yard AI (GitHub)', kind: 'proj', run: function () { window.open('https://github.com/marek727/cw-ai', '_blank', 'noopener'); } },
            { label: 'Project: Sketch (GitHub)', kind: 'proj', run: function () { window.open('https://github.com/FelixvanDijk/Sketch', '_blank', 'noopener'); } },
            { label: 'Project: S&F Barbers (live demo)', kind: 'proj', run: function () { window.open('https://nath-booking-p6ty.onrender.com', '_blank', 'noopener'); } },
            { label: 'Project: Cold Emailer (GitHub)', kind: 'proj', run: function () { window.open('https://github.com/FelixvanDijk/COLD_EMAILER', '_blank', 'noopener'); } },
            { label: 'Read Gathouse case study (PDF)', kind: 'open', run: function () { window.open('assets/vets.pdf', '_blank', 'noopener'); } },
            { label: 'Email ' + (IS_BIZ ? 'F van Dijk Ltd' : 'Felix'), kind: 'act', run: function () { window.location.href = 'mailto:' + EMAIL; } },
            { label: 'Copy email address', kind: 'act', run: function () { var b = $('#copy-email'); if (b) b.click(); } },
            { label: 'Open LinkedIn', kind: 'open', run: function () { window.open(IS_BIZ ? 'https://www.linkedin.com/company/f-van-dijk-ltd/' : 'https://www.linkedin.com/in/felix-van-dijk-81a1ba2ba/', '_blank', 'noopener'); } },
            { label: 'View source on GitHub', kind: 'open', run: function () { window.open('https://github.com/FelixvanDijk/My-Portfolio', '_blank', 'noopener'); } },
            { label: 'Toggle CRT mode', kind: 'fun', run: function () { toggleCrt(); } },
            { label: 'Keyboard shortcuts', kind: 'help', run: function () { openKbd(); } }
        );

        function fuzzy(q, s) {
            q = q.toLowerCase(); s = s.toLowerCase();
            var qi = 0;
            for (var si = 0; si < s.length && qi < q.length; si++) {
                if (s[si] === q[qi]) qi++;
            }
            return qi === q.length;
        }

        function render() {
            var q = input.value.trim();
            visible = q ? commands.filter(function (c) { return fuzzy(q, c.label); }) : commands.slice();
            selIdx = clamp(selIdx, 0, Math.max(0, visible.length - 1));
            list.innerHTML = visible.map(function (c, i) {
                return '<li role="option" id="pal-opt-' + i + '" data-i="' + i + '"' +
                    ' aria-selected="' + (i === selIdx) + '" class="' + (i === selIdx ? 'is-sel' : '') + '">' +
                    '<span>' + c.label + '</span><span class="cmd-kind">' + c.kind + '</span></li>';
            }).join('') || '<li><span>command not found</span><span class="cmd-kind">404</span></li>';
            if (visible.length) input.setAttribute('aria-activedescendant', 'pal-opt-' + selIdx);
            else input.removeAttribute('aria-activedescendant');
        }

        function open() {
            lastFocus = document.activeElement;
            openedAt = Date.now();
            overlay.hidden = false;
            input.value = '';
            selIdx = 0;
            render();
            input.focus();
        }
        function close() {
            overlay.hidden = true;
            if (lastFocus && lastFocus.focus) lastFocus.focus();
        }
        function runSel() {
            var c = visible[selIdx];
            if (!c) return;
            close();
            setTimeout(c.run, 60);
        }

        if (btn) btn.addEventListener('click', open);
        input.addEventListener('input', function () { selIdx = 0; render(); });
        input.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowDown') { e.preventDefault(); selIdx = Math.min(selIdx + 1, visible.length - 1); render(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); selIdx = Math.max(selIdx - 1, 0); render(); }
            else if (e.key === 'Enter') { e.preventDefault(); runSel(); }
            else if (e.key === 'Tab') { e.preventDefault(); } // input is the only focusable: trap
        });
        list.addEventListener('click', function (e) {
            var li = e.target.closest('li[data-i]');
            if (!li) return;
            selIdx = parseInt(li.dataset.i, 10);
            runSel();
        });
        overlay.addEventListener('click', function (e) {
            // ignore the tail of the click that opened us (tap-through guard)
            if (e.target === overlay && Date.now() - openedAt > 200) close();
        });

        window.openPalette = open;
        window.closePalette = close;
        window.isPaletteOpen = function () { return !overlay.hidden; };
    })();

    /* ============================================================
       KEYBOARD HELP
       ============================================================ */
    var kbdHelp = $('#kbd-help');
    function openKbd() {
        if (!kbdHelp) return;
        kbdHelp.hidden = false;
        var c = $('#kbd-close');
        if (c) c.focus();
    }
    function closeKbd() { if (kbdHelp) kbdHelp.hidden = true; }
    if (kbdHelp) {
        var kbdClose = $('#kbd-close');
        if (kbdClose) kbdClose.addEventListener('click', closeKbd);
        kbdHelp.addEventListener('click', function (e) { if (e.target === kbdHelp) closeKbd(); });
        kbdHelp.addEventListener('keydown', function (e) {
            if (e.key === 'Tab') e.preventDefault(); // close button is the only focusable: trap
        });
    }

    /* ============================================================
       GLOBAL KEYS — palette, help, section jumps, easter eggs
       ============================================================ */
    var KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    var konamiIdx = 0;
    var typeBuffer = '';
    var crtTimer = null;

    var sbFileOriginal = ($('.sb-file') || {}).textContent || 'felix.c';
    function toggleCrt(forceOff) {
        var sbFile = $('.sb-file');
        if (forceOff || docEl.classList.contains('crt')) {
            docEl.classList.remove('crt');
            if (sbFile) sbFile.textContent = sbFileOriginal;
            if (crtTimer) { clearTimeout(crtTimer); crtTimer = null; }
            return;
        }
        if (reduceMotion) return;
        docEl.classList.add('crt');
        if (sbFile) sbFile.textContent = sbFileOriginal + ' (1987 build)';
        toast('CRT mode — 10 seconds of 1987');
        crtTimer = setTimeout(function () { toggleCrt(true); }, 10000);
    }

    document.addEventListener('keydown', function (e) {
        // close overlays
        if (e.key === 'Escape') {
            if (window.isPaletteOpen && window.isPaletteOpen()) { window.closePalette(); return; }
            if (kbdHelp && !kbdHelp.hidden) { closeKbd(); return; }
            closeMobileMenu();
            return;
        }

        // command palette
        if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
            e.preventDefault();
            if (window.openPalette) window.openPalette();
            return;
        }

        if (inField()) return;
        if (window.isPaletteOpen && window.isPaletteOpen()) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return; // never shadow browser shortcuts

        // konami (works regardless of buffer)
        var expected = KONAMI[konamiIdx];
        var key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        if (key === expected) {
            konamiIdx++;
            if (konamiIdx === KONAMI.length) {
                konamiIdx = 0;
                toggleCrt();
            }
        } else {
            konamiIdx = key === KONAMI[0] ? 1 : 0;
        }

        // '?' help
        if (e.key === '?') {
            e.preventDefault();
            if (kbdHelp && kbdHelp.hidden) openKbd();
            else closeKbd();
            return;
        }

        // 1-6 section jumps
        var n = parseInt(e.key, 10);
        if (n >= 1 && n <= SECTIONS.length) {
            var target = document.getElementById(SECTIONS[n - 1]);
            if (target) {
                if (SECTIONS[n - 1] === 'projects') scrollToProject(0);
                else scrollToEl(target);
            }
        }

        // 'sudo hire felix'
        if (e.key.length === 1) {
            typeBuffer = (typeBuffer + e.key.toLowerCase()).slice(-20);
            if (typeBuffer.indexOf('sudo hire felix') > -1) {
                typeBuffer = '';
                toast('permission granted ✓');
                scrollToEl($('#contact'));
                setTimeout(function () {
                    var nameField = $('#name');
                    if (nameField) nameField.focus();
                }, 1300);
            }
        }
    });

    /* ============================================================
       EASTER EGGS — tab clicks, paw prints, console, title flip
       ============================================================ */
    (function tabSegfault() {
        var tab = $('#file-tab');
        if (!tab) return;
        var clicks = [];
        tab.addEventListener('click', function () {
            scrollToY(0); // the felix.c tab doubles as "home"
            var now = Date.now();
            clicks = clicks.filter(function (t) { return now - t < 3000; });
            clicks.push(now);
            if (clicks.length >= 5) {
                clicks = [];
                toast('segmentation fault (core dumped)', true, 1400);
                setTimeout(function () { toast('just kidding — memory safe since 2023'); }, 1100);
            }
        });
    })();

    (function pawPrints() {
        var card = $('#proj-0');
        if (!card) return;
        var clicks = [];
        card.addEventListener('click', function (e) {
            if (e.target.closest('a, button')) return;
            var now = Date.now();
            clicks = clicks.filter(function (t) { return now - t < 1400; });
            clicks.push(now);
            if (clicks.length >= 3) {
                clicks = [];
                for (var i = 0; i < 5; i++) {
                    (function (i) {
                        setTimeout(function () {
                            var paw = document.createElement('span');
                            paw.className = 'paw';
                            paw.textContent = '🐾';
                            paw.style.left = (e.clientX + (i + 1) * 34 * (i % 2 ? 1 : 0.6)) + 'px';
                            paw.style.top = (e.clientY - i * 30) + 'px';
                            paw.style.setProperty('--rot', ((i % 2 ? 1 : -1) * 18) + 'deg');
                            document.body.appendChild(paw);
                            setTimeout(function () { paw.remove(); }, 1700);
                        }, i * 130);
                    })(i);
                }
            }
        });
    })();

    // console greeting for the curious
    try {
        console.log(
            '%c felix.c %c\n\nCurious. I like that.\nThe source is at https://github.com/FelixvanDijk/My-Portfolio\n' + EMAIL + ' if you want to talk.\n',
            'background:#22C55E;color:#0A0E1A;font-size:20px;font-weight:bold;padding:6px 14px;border-radius:4px;',
            ''
        );
    } catch (err) { /* no console */ }

    // tab title flip
    (function titleFlip() {
        var original = document.title;
        document.addEventListener('visibilitychange', function () {
            document.title = document.hidden ? 'felix.c — paused ⏸' : original;
        });
    })();

    /* ============================================================
       MEMORY-SPACE CANVAS — drifting glyph field
       ============================================================ */
    (function memoryCanvas() {
        var canvas = $('#memory-canvas');
        if (!canvas || reduceMotion || !canvas.getContext) {
            docEl.classList.add('no-canvas');
            if (canvas) canvas.remove();
            return;
        }

        var ctx = canvas.getContext('2d');
        var GLYPHS = ['{', '}', ';', '=>', '0x7F', 'printf', 'git', '✓', '</>', '&&', 'int', '*ptr', '::', '01', '#', 'fn'];
        var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        var W = 0, H = 0;
        var particles = [];
        var pointer = { x: -9999, y: -9999 };
        var scrollVel = 0;
        var lastScrollY = window.scrollY;
        var degraded = 0;
        var running = true;
        var finePointer = window.matchMedia('(pointer: fine)').matches;

        function targetCount() {
            var base = window.innerWidth < 768 ? 60 : 140;
            return degraded > 0 ? Math.floor(base / 2) : base;
        }

        function resize() {
            W = window.innerWidth;
            H = window.innerHeight;
            canvas.width = Math.floor(W * dpr);
            canvas.height = Math.floor(H * dpr);
            canvas.style.width = W + 'px';
            canvas.style.height = H + 'px';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            seed();
        }

        function makeParticle(randomY) {
            return {
                x: Math.random() * W,
                y: randomY ? Math.random() * H : H + 20,
                v: 0.06 + Math.random() * 0.12,            // px per ms upward
                size: 10 + Math.random() * 4,
                alpha: 0.04 + Math.random() * 0.04,
                glyph: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
                drift: (Math.random() - 0.5) * 0.01
            };
        }

        function seed() {
            var n = targetCount();
            particles = [];
            for (var i = 0; i < n; i++) particles.push(makeParticle(true));
        }

        if (finePointer) {
            window.addEventListener('pointermove', function (e) {
                pointer.x = e.clientX;
                pointer.y = e.clientY;
            }, { passive: true });
        }

        window.addEventListener('scroll', function () {
            var y = window.scrollY;
            scrollVel = clamp(Math.abs(y - lastScrollY), 0, 80);
            lastScrollY = y;
        }, { passive: true });

        // perf monitor: degrade if frames stay slow
        var frameTimes = [];
        var lastCheck = performance.now();

        var lastT = performance.now();
        function frame(now) {
            if (!running) return;
            var dt = Math.min(now - lastT, 50);
            lastT = now;

            if (!document.hidden) {
                frameTimes.push(dt);
                if (now - lastCheck > 2000) {
                    var avg = frameTimes.reduce(function (a, b) { return a + b; }, 0) / Math.max(frameTimes.length, 1);
                    frameTimes = [];
                    lastCheck = now;
                    if (avg > 22 && degraded < 2) {
                        degraded++;
                        if (degraded === 1) seed();
                        if (degraded === 2) {
                            running = false;
                            docEl.classList.add('no-canvas');
                            canvas.remove();
                            return;
                        }
                    }
                }

                ctx.clearRect(0, 0, W, H);

                // compile warmth: bottom radial glow grows with scroll progress
                var doc = document.documentElement;
                var maxScroll = doc.scrollHeight - window.innerHeight;
                var progress = maxScroll > 0 ? clamp(window.scrollY / maxScroll, 0, 1) : 0;
                if (progress > 0.02) {
                    var warm = IS_BIZ ? '74,144,226' : '34,197,94';
                    var grad = ctx.createRadialGradient(W / 2, H * 1.1, 0, W / 2, H * 1.1, H * 0.9);
                    grad.addColorStop(0, 'rgba(' + warm + ',' + (0.055 * progress).toFixed(3) + ')');
                    grad.addColorStop(1, 'rgba(' + warm + ',0)');
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, 0, W, H);
                }

                var stretch = degraded > 0 ? 0 : clamp(scrollVel / 40, 0, 1.4);
                scrollVel *= 0.9;

                ctx.font = '12px "JetBrains Mono", monospace';
                for (var i = 0; i < particles.length; i++) {
                    var p = particles[i];
                    p.y -= p.v * dt * (1 + stretch * 2.2);
                    p.x += p.drift * dt;

                    // cursor repulsion
                    if (finePointer) {
                        var dx = p.x - pointer.x;
                        var dy = p.y - pointer.y;
                        var d2 = dx * dx + dy * dy;
                        if (d2 < 8100 && d2 > 1) {
                            var d = Math.sqrt(d2);
                            var f = (90 - d) / 90 * 0.06 * dt;
                            p.x += (dx / d) * f * 16;
                            p.y += (dy / d) * f * 16;
                        }
                    }

                    if (p.y < -24) {
                        particles[i] = makeParticle(false);
                        continue;
                    }
                    if (p.x < -40) p.x = W + 20;
                    if (p.x > W + 40) p.x = -20;

                    var a = p.alpha * (1 + stretch * 0.8);
                    ctx.fillStyle = 'rgba(148, 163, 184, ' + clamp(a, 0, 0.16).toFixed(3) + ')';
                    ctx.font = p.size + 'px "JetBrains Mono", monospace';
                    if (stretch > 0.25) {
                        ctx.save();
                        ctx.translate(p.x, p.y);
                        ctx.scale(1, 1 + stretch);
                        ctx.fillText(p.glyph, 0, 0);
                        ctx.restore();
                    } else {
                        ctx.fillText(p.glyph, p.x, p.y);
                    }
                }
            }
            requestAnimationFrame(frame);
        }

        resize();
        window.addEventListener('resize', resize);
        requestAnimationFrame(frame);
    })();

})();
