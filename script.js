/**
 * BONDS Global — Shared page behaviors
 *
 * Responsibilities:
 * - Animate stat counters when they scroll into view
 * - Reveal animations for .reveal elements
 * - Header scroll state
 * - Scroll progress bar
 * - Hero particle canvas (if present)
 * - Current year in footer #y
 *
 * Theme toggle and mobile nav are handled by site-layout.js to avoid duplication.
 */
(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Header scroll state ---------- */
  const header = document.getElementById('header');
  if (header) {
    let ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        header.classList.toggle('scrolled', window.scrollY > 20);
        ticking = false;
      });
    }, { passive: true });
  }

  /* ---------- Scroll progress bar ---------- */
  const progress = document.createElement('div');
  progress.id = 'scrollProgress';
  document.body.appendChild(progress);

  let progressTicking = false;
  function updateScrollProgress() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = docHeight > 0 ? (scrollTop / docHeight * 100) + '%' : '0%';
  }
  window.addEventListener('scroll', function () {
    if (progressTicking) return;
    progressTicking = true;
    requestAnimationFrame(function () {
      updateScrollProgress();
      progressTicking = false;
    });
  }, { passive: true });
  updateScrollProgress();

  /* ---------- Stat counters ---------- */
  function animateCounter(el) {
    const target = parseInt(el.getAttribute('data-target'), 10);
    if (isNaN(target)) return;
    const suffix = el.getAttribute('data-suffix') || '';
    const prefix = el.getAttribute('data-prefix') || '';

    if (prefersReducedMotion) {
      el.textContent = prefix + target.toLocaleString('en') + suffix;
      return;
    }

    const start = performance.now();
    const duration = 1800;

    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      const value = Math.round(target * eased);
      el.textContent = prefix + value.toLocaleString('en') + suffix;
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  const counters = document.querySelectorAll('.stat-num[data-target]');
  if (counters.length && 'IntersectionObserver' in window) {
    const counterObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    counters.forEach(function (c) { counterObserver.observe(c); });
  }

  /* ---------- Reveal on scroll ---------- */
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length && 'IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(function (r) { revealObserver.observe(r); });
  }

  /* ---------- Current year ---------- */
  const yearEl = document.getElementById('y');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------- Hero particles canvas ---------- */
  const hero = document.querySelector('.hero');
  if (hero && !prefersReducedMotion) {
    const canvas = document.createElement('canvas');
    canvas.id = 'particlesCanvas';
    hero.insertBefore(canvas, hero.firstChild);
    const ctx = canvas.getContext('2d');
    const particles = [];
    const count = window.innerWidth < 768 ? 30 : 60;

    function resizeCanvas() {
      canvas.width = hero.offsetWidth;
      canvas.height = hero.offsetHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: 0.3 * (Math.random() - 0.5),
        vy: 0.3 * (Math.random() - 0.5),
        size: 2 * Math.random() + 1,
        color: Math.random() > 0.5 ? 'rgba(212,168,83,' : 'rgba(59,130,246,',
        opacity: 0.5 * Math.random() + 0.2
      });
    }

    (function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(function (p) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, 2 * Math.PI);
        ctx.fillStyle = p.color + p.opacity + ')';
        ctx.fill();
      });
      requestAnimationFrame(draw);
    })();
  }
})();
