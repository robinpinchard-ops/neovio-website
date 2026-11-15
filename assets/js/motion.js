// Motion layer: smooth scroll (Lenis). Imported lazily by site.js, never under
// prefers-reduced-motion. Set to false to fall back to native scrolling.
const SMOOTH_SCROLL = true;

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
  if (!SMOOTH_SCROLL || !window.matchMedia('(pointer: fine)').matches) return null;

  await loadScript(new URL('../vendor/lenis-1.3.27.min.js', import.meta.url).href);
  // anchors: in-page links go through Lenis, otherwise the native jump and the
  // smoothed position disagree and the page rewinds. Lenis already honours the
  // scroll-padding-top set in site.css, so no extra offset here.
  return new window.Lenis({ autoRaf: true, lerp: 0.11, anchors: true });
}

export const lenis = await initSmoothScroll();
