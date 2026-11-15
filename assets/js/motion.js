// Motion layer — imported lazily by site.js, never under prefers-reduced-motion.
// Three parts: smooth scroll (Lenis), a scrub engine that turns scroll position
// into a 0..1 `--p` custom property per scene, and the hero thread (canvas).
// The page is complete without this file: `--p` defaults to 1 (end state).

const SMOOTH_SCROLL = true; // false = native scrolling everywhere

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* ------------------------------------------------------------
   Smooth scroll
   ------------------------------------------------------------ */
function loadScript(url) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function initSmoothScroll() {
  // Touch devices keep native scrolling: momentum there is already right,
  // and intercepting it only makes it worse.
  if (!SMOOTH_SCROLL || !window.matchMedia('(pointer: fine)').matches) return;
  await loadScript(new URL('../vendor/lenis-1.3.27.min.js', import.meta.url).href);
  // anchors: in-page links go through Lenis, otherwise the native jump and the
  // smoothed position disagree and the page rewinds. Lenis already honours the
  // scroll-padding-top set in site.css, so no extra offset here.
  new window.Lenis({ autoRaf: true, lerp: 0.11, anchors: true });
}

/* ------------------------------------------------------------
   Scrub engine
   [data-scrub="pin"]    progress through a tall track holding a sticky child
   [data-scrub="thread"] progress of a reading head at 62% of the viewport
   Geometry is measured on resize only; each frame is plain arithmetic, and
   `--p` is written only when its rounded value changes.
   ------------------------------------------------------------ */
const scenes = [...document.querySelectorAll('[data-scrub]')].map((el) => ({
  el, mode: el.dataset.scrub, top: 0, height: 0, last: -1, onUpdate: null,
}));
let viewportH = window.innerHeight;

function measure() {
  viewportH = window.innerHeight;
  const y = window.scrollY;
  for (const s of scenes) {
    const r = s.el.getBoundingClientRect();
    s.top = r.top + y;
    s.height = r.height;
    s.last = -1; // force a rewrite with the new geometry
  }
}

function progressOf(s, y) {
  if (s.mode === 'pin') {
    const travel = s.height - viewportH;
    // No sticky travel (mobile: the scene is not pinned): scrub while it leaves.
    return travel > viewportH * 0.25 ? (y - s.top) / travel : (y - s.top) / (s.height * 0.6);
  }
  return (y + viewportH * 0.62 - s.top) / s.height;
}

function frame(now) {
  const y = window.scrollY;
  for (const s of scenes) {
    const p = Math.round(clamp01(progressOf(s, y)) * 1000) / 1000;
    if (p !== s.last) {
      s.last = p;
      s.el.style.setProperty('--p', p);
    }
    if (s.onUpdate) s.onUpdate(p, now, y);
  }
  requestAnimationFrame(frame);
}

/* ------------------------------------------------------------
   Hero thread
   A handful of tangled strands (the repetitive tasks) that relax, as the
   visitor scrolls, into one line. That line runs along the hero's bottom rule,
   turns at the left margin and leaves the screen: the page's thread starts
   exactly there.
   ------------------------------------------------------------ */
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Resample a polyline into `count` points evenly spaced along its length.
function resample(points, count) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    lengths.push(lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  }
  const total = lengths[lengths.length - 1];
  const out = [];
  let seg = 1;
  for (let i = 0; i < count; i++) {
    const d = (i / (count - 1)) * total;
    while (seg < points.length - 1 && lengths[seg] < d) seg++;
    const t = (d - lengths[seg - 1]) / (lengths[seg] - lengths[seg - 1] || 1);
    out.push([lerp(points[seg - 1][0], points[seg][0], t), lerp(points[seg - 1][1], points[seg][1], t)]);
  }
  return out;
}

function initHeroThread(scene) {
  const canvas = document.getElementById('hero-thread');
  const pin = canvas && canvas.parentElement;
  const rule = pin && pin.querySelector('.hero-trust');
  const knot = pin && pin.querySelector('.hero-knot'); // band reserved for the tangle on small screens
  if (!canvas || !rule) return;
  const ctx = canvas.getContext('2d');

  const POINTS = 28;
  const INTRO_MS = 1200; // --dur-4
  let W = 0, H = 0, strands = [], target = [], startTime = 0, visible = true;

  function build() {
    const small = window.innerWidth < 861;
    const dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
    W = pin.clientWidth; H = pin.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // offsetLeft/Top, not getBoundingClientRect: the rule is mid-animation
    // (fade-up) when this first runs, and offsets ignore transforms.
    const foot = rule.offsetParent;
    const threadOff = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--thread-off')) || 0;
    const x0 = Math.round(foot.offsetLeft + rule.offsetLeft - threadOff) + 0.5; // where the page thread runs
    const yRule = Math.round(foot.offsetTop + rule.offsetTop) + 0.5;            // the hero's bottom rule
    const radius = small ? 10 : 18;
    // Small screens: the tangle lives in its own band between the buttons and
    // the rule, so it never sits on the text or on a button.
    const bandTop = knot ? knot.offsetTop : yRule - H * 0.16;
    const bandH = knot && knot.offsetHeight ? knot.offsetHeight : H * 0.14;

    // End state: in from the right edge, down to the rule, along it, round the
    // corner, and out through the bottom at the thread's x.
    const path = [];
    const a = [W + 24, small ? bandTop + bandH * 0.15 : H * 0.2], b = [W * (small ? 0.95 : 0.9), small ? bandTop + bandH * 0.2 : H * 0.24], c = [W * 0.97, yRule], d = [W * (small ? 0.8 : 0.72), yRule];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40, u = 1 - t;
      path.push([
        u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
        u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
      ]);
    }
    path.push([x0 + radius, yRule]);
    for (let i = 1; i <= 8; i++) {
      const ang = (i / 8) * (Math.PI / 2);
      path.push([x0 + radius - Math.sin(ang) * radius, yRule + radius - Math.cos(ang) * radius]);
    }
    path.push([x0, H + 24]);
    target = resample(path, POINTS);

    // Start state: every strand enters on the right, wanders through a knot,
    // and leaves through the bottom somewhere else. Seeded: same tangle on
    // every visit, no layout-dependent randomness.
    const rand = mulberry32(11);
    const count = small ? 6 : 11;
    const cx = W * (small ? 0.6 : 0.74), cy = small ? bandTop + bandH * 0.5 : H * 0.44;
    const rx = W * (small ? 0.3 : 0.22), ry = small ? bandH * 0.42 : H * 0.32;
    strands = [];
    for (let i = 0; i < count; i++) {
      const pts = [];
      let angle = rand() * Math.PI * 2;
      for (let j = 0; j < POINTS; j++) {
        if (j === 0) pts.push([W + 24, small ? bandTop + bandH * (0.1 + rand() * 0.8) : H * (0.08 + rand() * 0.6), 0, 0]);
        else if (j === POINTS - 1) pts.push([lerp(x0, W, 0.3 + rand() * 0.68), H + 24, 0, 0]);
        else {
          angle += 0.5 + rand() * 1.5;
          const r = 0.3 + rand() * 0.7;
          // [x, y, wobble phase, wobble speed]
          pts.push([cx + Math.cos(angle) * rx * r, cy + Math.sin(angle) * ry * r, rand() * Math.PI * 2, 0.25 + rand() * 0.5]);
        }
      }
      strands.push(pts);
    }
  }

  function draw(p, now) {
    if (!visible || document.hidden) return;
    if (!startTime) startTime = now;
    const intro = easeInOut(clamp01((now - startTime) / INTRO_MS));
    const time = now / 1000;
    const small = W < 861;
    // Small screens are not pinned: the text would scroll away before the
    // thread settles. So it also untangles on its own, shortly after it is drawn.
    if (small) p = Math.max(p, clamp01((now - startTime - INTRO_MS - 500) / 2400));
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 1.2;
    ctx.lineJoin = 'round';

    const n = strands.length;
    for (let i = n - 1; i >= 0; i--) {
      // Strands settle one after the other; strand 0 is the one that remains.
      const e = easeInOut(clamp01(p * 1.3 - (i / n) * 0.3));
      const pts = strands[i];
      const lead = i === 0;
      const tangledAlpha = lead ? 0.9 : small ? 0.2 : 0.28;
      // Grey-blue while tangled, cyan once in line. Settled strands overlap
      // strand 0, so they fade out rather than stack.
      const r = Math.round(lerp(lead ? 0 : 152, 0, e)), g = Math.round(lerp(lead ? 212 : 162, 212, e)), b = Math.round(lerp(lead ? 255 : 184, 255, e));
      ctx.strokeStyle = `rgba(${r},${g},${b},${lead ? 0.9 : lerp(tangledAlpha, 0, Math.max(0, e * 2 - 1))})`;

      const last = intro * (POINTS - 1);
      ctx.beginPath();
      let px = 0, py = 0;
      for (let j = 0; j <= Math.ceil(last) && j < POINTS; j++) {
        const q = pts[j];
        const wob = (1 - e) * 6;
        let x = lerp(q[0] + Math.sin(time * q[3] + q[2]) * wob, target[j][0], e);
        let y = lerp(q[1] + Math.cos(time * q[3] * 0.8 + q[2]) * wob, target[j][1], e);
        if (j > last) { const f = last - (j - 1); x = lerp(px, x, f); y = lerp(py, y, f); } // partial segment while drawing in
        if (j === 0) ctx.moveTo(x, y);
        // Smooth the polyline through midpoints; collinear points stay straight.
        else if (j === 1) ctx.lineTo((px + x) / 2, (py + y) / 2);
        else ctx.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
        px = x; py = y;
      }
      ctx.lineTo(px, py);
      ctx.stroke();
    }
  }

  build();
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(pin);
  scene.onUpdate = draw;
  return build;
}

/* ------------------------------------------------------------
   Boot
   ------------------------------------------------------------ */
const heroScene = scenes.find((s) => s.el.id === 'hero');
const rebuildHero = heroScene ? initHeroThread(heroScene) : null;

let resizeTimer = 0;
function onResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { measure(); if (rebuildHero) rebuildHero(); }, 120);
}
window.addEventListener('resize', onResize, { passive: true });
// Late layout changes (fonts, the contact tabs) move the scenes too.
new ResizeObserver(onResize).observe(document.body);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(onResize);

measure();
requestAnimationFrame(frame);
initSmoothScroll().catch((err) => console.warn('[Neovio] smooth scroll skipped:', err));
