/* =====================================================
   KoalaFlyff — app.js
   Scroll reveals, hamburger menu, smooth scroll, nav,
   language toggle, mockup animation
   ===================================================== */

(function () {
  'use strict';

  /* ── Scroll Reveal ─────────────────────────────────── */
  function initScrollReveal() {
    const elements = document.querySelectorAll('[data-reveal]');
    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Stagger cards in grids
            const delay = entry.target.closest('.features-grid')
              ? Array.from(entry.target.parentElement.children).indexOf(entry.target) * 80
              : 0;
            setTimeout(() => {
              entry.target.classList.add('revealed');
            }, delay);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    elements.forEach((el) => observer.observe(el));
  }

  /* ── Nav Scroll Behavior ───────────────────────────── */
  function initNavScroll() {
    const nav = document.getElementById('nav');
    if (!nav) return;

    let ticking = false;

    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(() => {
          if (window.scrollY > 20) {
            nav.classList.add('scrolled');
          } else {
            nav.classList.remove('scrolled');
          }
          ticking = false;
        });
        ticking = true;
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ── Hamburger Menu ────────────────────────────────── */
  function initHamburger() {
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('nav-links');
    if (!hamburger || !navLinks) return;

    function toggleMenu(open) {
      const isOpen = open !== undefined ? open : hamburger.getAttribute('aria-expanded') !== 'true';
      hamburger.setAttribute('aria-expanded', String(isOpen));
      navLinks.classList.toggle('open', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    }

    hamburger.addEventListener('click', () => toggleMenu());

    navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => toggleMenu(false));
    });

    document.addEventListener('click', (e) => {
      if (
        hamburger.getAttribute('aria-expanded') === 'true' &&
        !hamburger.contains(e.target) &&
        !navLinks.contains(e.target)
      ) {
        toggleMenu(false);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && hamburger.getAttribute('aria-expanded') === 'true') {
        toggleMenu(false);
        hamburger.focus();
      }
    });

    window.addEventListener(
      'resize',
      debounce(() => {
        if (window.innerWidth > 768) {
          toggleMenu(false);
        }
      }, 150)
    );
  }

  /* ── Smooth Scroll for anchor links ────────────────── */
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href === '#') return;
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  }

  /* ── Language Toggle (DE / EN) ─────────────────────── */
  function initLangToggle() {
    const STORAGE_KEY = 'koalaflyff-lang';
    const DEFAULT_LANG = 'en';

    function getPreferredLang() {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'de' || saved === 'en') return saved;
      return navigator.language && navigator.language.startsWith('de') ? 'de' : DEFAULT_LANG;
    }

    function applyLang(lang) {
      document.documentElement.setAttribute('lang', lang);
      localStorage.setItem(STORAGE_KEY, lang);

      document.querySelectorAll('[lang="de"], [lang="en"]').forEach((el) => {
        if (el === document.documentElement) return;
        el.style.display = el.getAttribute('lang') === lang ? '' : 'none';
      });

      document.querySelectorAll('.lang-toggle').forEach((btn) => {
        btn.textContent = lang === 'de' ? '🌐 EN' : '🌐 DE';
        btn.setAttribute('aria-label', lang === 'de' ? 'Switch to English' : 'Auf Deutsch wechseln');
        btn.setAttribute('aria-pressed', 'false');
      });

      const path = window.location.pathname;
      if (path.endsWith('impressum.html')) {
        document.title = lang === 'de' ? 'Impressum — KoalaFlyff' : 'Legal Notice — KoalaFlyff';
      } else if (path.endsWith('datenschutz.html')) {
        document.title = lang === 'de' ? 'Datenschutzerklärung — KoalaFlyff' : 'Privacy Policy — KoalaFlyff';
      } else {
        document.title = lang === 'de'
          ? 'KoalaFlyff — Der ultimative Multi-Boxing-Begleiter für Flyff Universe'
          : 'KoalaFlyff — The Ultimate Multi-Boxing Companion for Flyff Universe';
      }
    }

    function toggleLang() {
      const current = document.documentElement.getAttribute('lang') || DEFAULT_LANG;
      applyLang(current === 'de' ? 'en' : 'de');
    }

    document.querySelectorAll('.lang-toggle').forEach((btn) => {
      btn.addEventListener('click', toggleLang);
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleLang(); }
      });
    });

    applyLang(getPreferredLang());
  }

  /* ── Email Reveal ──────────────────────────────────── */
  function initEmailReveal() {
    document.querySelectorAll('.email-reveal').forEach((el) => {
      function reveal() {
        if (this.dataset.revealed === 'true') return;
        const user = this.dataset.user;
        const domain = this.dataset.domain;
        if (user && domain) {
          const address = user + '@' + domain;
          this.dataset.revealed = 'true';
          const link = document.createElement('a');
          link.href = 'mailto:' + address;
          link.textContent = address;
          link.className = 'email-link';
          this.replaceWith(link);
        }
      }
      el.addEventListener('click', reveal);
      el.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reveal.call(this); }
      });
    });
  }

  /* ── Mockup: animated timer ────────────────────────── */
  function initMockupAnimation() {
    const timerEl = document.getElementById('mockup-timer');
    if (!timerEl) return;

    let seconds = 14 * 60 + 32;
    const timerInterval = setInterval(() => {
      seconds++;
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      timerEl.textContent =
        String(h).padStart(2, '0') + ':' +
        String(m).padStart(2, '0') + ':' +
        String(s).padStart(2, '0');
    }, 1000);

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      clearInterval(timerInterval);
    });
  }

  /* ── Mockup: tab click handler ─────────────────────── */
  function initMockupTabs() {
    const tabs = document.querySelectorAll('.pm-tab');
    if (!tabs.length) return;

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const panelId = tab.getAttribute('data-panel');
        if (!panelId) return;

        // Update tab active states
        tabs.forEach(t => t.classList.remove('pm-tab-active'));
        tab.classList.add('pm-tab-active');

        // Update panel visibility
        document.querySelectorAll('.pm-body').forEach(panel => {
          panel.style.display = 'none';
          panel.classList.remove('pm-panel-active');
        });
        const activePanel = document.getElementById(panelId);
        if (activePanel) {
          activePanel.style.display = 'flex';
          activePanel.classList.add('pm-panel-active');
        }
      });
    });
  }

  /* ── Active nav link highlight ─────────────────────── */
  function initActiveNavLink() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link[href^="#"]');
    if (!sections.length || !navLinks.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('id');
            navLinks.forEach((link) => {
              const isActive = link.getAttribute('href') === `#${id}`;
              link.style.color = isActive ? 'var(--accent-2)' : '';
            });
          }
        });
      },
      {
        rootMargin: '-40% 0px -55% 0px',
      }
    );

    sections.forEach((section) => observer.observe(section));
  }

  /* ── Utility: debounce ─────────────────────────────── */
  function debounce(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  /* ── Init ──────────────────────────────────────────── */
  function init() {
    initNavScroll();
    initScrollReveal();
    initHamburger();
    initSmoothScroll();
    initLangToggle();
    initEmailReveal();
    initMockupAnimation();
    initMockupTabs();
    initActiveNavLink();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
