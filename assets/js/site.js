/* ============================================================
   2. Sticky nav state
   ============================================================ */
(function initNav() {
  const nav = document.getElementById('nav');
  const onScroll = () => {
    if (window.scrollY > 24) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
})();

/* ============================================================
   3. Mobile menu
   ============================================================ */
(function initMobileMenu() {
  const toggle = document.getElementById('nav-toggle');
  const menu = document.getElementById('mobile-menu');
  if (!toggle || !menu) return;
  const setOpen = (open) => {
    menu.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', () => setOpen(!menu.classList.contains('open')));
  menu.querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => setOpen(false))
  );
})();

/* ============================================================
   4. Reveal-on-scroll
   ============================================================ */
(function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    els.forEach(el => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        e.target.style.transitionDelay = (i % 3) * 80 + 'ms';
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  els.forEach(el => io.observe(el));
})();

/* ============================================================
   5. Contact form — submits to Netlify Forms
   ============================================================ */
(function initForm() {
  const form = document.getElementById('contact-form');
  const success = document.getElementById('form-success');
  const submitBtn = form && form.querySelector('button[type=submit]');
  if (!form) return;

  const SUBMIT_LABEL = 'Envoyer ma demande d\'audit <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7H11M11 7L7 3M11 7L7 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const required = form.querySelectorAll('[required]');
    let ok = true;
    required.forEach(input => {
      if (!input.value.trim()) { input.style.borderColor = '#ff5d6c'; ok = false; }
      else input.style.borderColor = '';
    });
    if (!ok) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi en cours…';

    try {
      const data = new FormData(form);
      const res = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(data).toString(),
      });

      if (res.ok) {
        success.classList.add('show');
        submitBtn.textContent = 'Envoyé ✓';
        setTimeout(() => {
          form.reset();
          success.classList.remove('show');
          submitBtn.disabled = false;
          submitBtn.innerHTML = SUBMIT_LABEL;
        }, 4500);
      } else {
        throw new Error('HTTP ' + res.status);
      }
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = SUBMIT_LABEL;
      alert('Une erreur est survenue. Veuillez réessayer ou nous contacter par email.');
      console.error('[Neovio] Form error:', err);
    }
  });
})();

/* ============================================================
   6. Contact panels — switch between booking and the message form
      The scheduler is a plain link to Cal.com rather than an embed: its month
      view needs more width than this column offers and its height changes at
      every booking step, so a fixed-height iframe always clipped something.
      A new tab also means no third-party request ever fires from this page.
   ============================================================ */
(function initBooking() {
  const sw        = document.getElementById('contact-switch');
  const panelBk   = document.getElementById('panel-booking');
  const panelForm = document.getElementById('contact-form');
  if (!sw || !panelBk || !panelForm) return;

  sw.hidden = false;
  function show(which) {
    const booking = which === 'booking';
    panelBk.hidden = !booking;
    panelForm.hidden = booking;
    sw.querySelectorAll('button').forEach(b =>
      b.setAttribute('aria-selected', String(b.dataset.panel === which))
    );
  }
  sw.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-panel]');
    if (btn) show(btn.dataset.panel);
  });
  show('booking');
})();

/* ============================================================
   7. Motion layer — smooth scroll and scroll-linked scenes.
      Loaded when the browser is idle, never under reduced motion:
      the page is complete without it.
   ============================================================ */
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const load = () => import('./motion.js').catch((err) => console.warn('[Neovio] motion layer skipped:', err));
  if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 1500 });
  else setTimeout(load, 200);
}
