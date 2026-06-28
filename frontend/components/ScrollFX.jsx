"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

// ---------------------------------------------------------------------------
// Global scroll/interaction effects, all progressive and reduced-motion aware:
//   • Parallax depth — [data-parallax] elements + the .mesh layer translate at
//     different speeds on scroll (translate3d, rAF-throttled).
//   • 3D tilt glass cards — cursor-reactive rotateX/rotateY via INLINE transform
//     (so it never fights CSS :hover or the reveal animations) + a moving
//     specular highlight; springs back on mouse-leave.
//   • Animated counters — [data-count] count up (ease-out cubic, ~1.7s) when in
//     view; if paired with an .fx-ring <circle>, drives its stroke-dashoffset.
//   • Reveal fallback — if CSS scroll-driven animations aren't supported, an
//     IntersectionObserver adds .in to .fx-reveal (CSS handles the transition).
//
// The root layout stays mounted across client-side navigation, so we re-scan on
// every route change to attach effects to the newly-rendered page.
// ---------------------------------------------------------------------------
function setup() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const supportsTimeline = typeof CSS !== "undefined" && CSS.supports && CSS.supports("animation-timeline: view()");
  const isTouch = window.matchMedia("(pointer: coarse)").matches;
  const cleanups = [];

  // ---- Reveal fallback (only when CSS scroll-driven anims are unsupported) ----
  if (!supportsTimeline) {
    document.documentElement.classList.add("js-fallback");
    const reveals = document.querySelectorAll(".fx-reveal:not(.in)");
    if (reveals.length) {
      const io = new IntersectionObserver((entries) => {
        for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
      reveals.forEach((el) => io.observe(el));
      cleanups.push(() => io.disconnect());
    }
  }

  // ---- Animated counters + optional SVG ring ----
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const counters = document.querySelectorAll("[data-count]:not([data-counted])");
  if (counters.length) {
    const run = (el) => {
      el.setAttribute("data-counted", "1");
      const to = parseFloat(el.getAttribute("data-count")) || 0;
      const dur = parseInt(el.getAttribute("data-count-dur"), 10) || 1700;
      const decimals = parseInt(el.getAttribute("data-count-decimals"), 10) || 0;
      const suffix = el.getAttribute("data-count-suffix") || "";
      const ringMax = parseFloat(el.getAttribute("data-count-ringmax")) || to || 1;
      // Optional ring: the LAST <circle> (progress arc, over the track) inside an
      // .fx-ring svg in the same [data-count-wrap].
      const ring = el.closest?.("[data-count-wrap]")?.querySelector?.(".fx-ring circle:last-of-type")
        || el.parentElement?.querySelector?.(".fx-ring circle:last-of-type");
      let len = 0;
      if (ring) {
        const r = ring.r?.baseVal?.value || 0;
        len = 2 * Math.PI * r;
        ring.style.strokeDasharray = String(len);
        ring.style.strokeDashoffset = String(len);
      }
      const offsetFor = (value) => len * (1 - Math.max(0, Math.min(1, value / ringMax)));
      if (reduce) {
        el.textContent = to.toFixed(decimals) + suffix;
        if (ring) ring.style.strokeDashoffset = String(offsetFor(to));
        return;
      }
      const start = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - start) / dur);
        const value = to * easeOutCubic(p);
        el.textContent = value.toFixed(decimals) + suffix;
        if (ring) ring.style.strokeDashoffset = String(offsetFor(value));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { run(e.target); io.unobserve(e.target); }
    }, { threshold: 0.4 });
    counters.forEach((el) => io.observe(el));
    cleanups.push(() => io.disconnect());
  }

  // ---- Parallax depth (rAF-throttled) ----
  const meshEls = Array.from(document.querySelectorAll(".mesh"));
  const parallaxEls = Array.from(document.querySelectorAll("[data-parallax]"));
  if (!reduce && (meshEls.length || parallaxEls.length)) {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return; ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY || 0;
        meshEls.forEach((m) => { m.style.transform = `translate3d(0, ${y * 0.12}px, 0)`; });
        parallaxEls.forEach((el) => {
          const speed = parseFloat(el.getAttribute("data-parallax")) || 0.15;
          el.style.transform = `translate3d(0, ${(y * speed * -0.1).toFixed(2)}px, 0)`;
        });
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    cleanups.push(() => window.removeEventListener("scroll", onScroll));
  }

  // ---- 3D tilt glass cards (opt-in: only elements with the .tilt class) ----
  if (!reduce && !isTouch) {
    const cards = Array.from(document.querySelectorAll(".tilt"));
    const MAX = 6; // degrees
    const onMove = (e) => {
      const el = e.currentTarget;
      const rect = el.getBoundingClientRect();
      if (rect.height > window.innerHeight * 0.92) return; // skip full-height editors
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const ry = (px - 0.5) * 2 * MAX;
      const rx = -(py - 0.5) * 2 * MAX;
      el.classList.add("tilting");
      el.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
      el.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
      el.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
    };
    const onLeave = (e) => {
      const el = e.currentTarget;
      el.classList.remove("tilting");
      el.style.transform = ""; // spring back via CSS transition
    };
    cards.forEach((el) => { el.addEventListener("mousemove", onMove); el.addEventListener("mouseleave", onLeave); });
    cleanups.push(() => cards.forEach((el) => { el.removeEventListener("mousemove", onMove); el.removeEventListener("mouseleave", onLeave); }));
  }

  return () => cleanups.forEach((fn) => fn());
}

export default function ScrollFX() {
  const pathname = usePathname();
  useEffect(() => {
    let teardown = () => {};
    // Let the new route's DOM commit before querying it.
    const raf = requestAnimationFrame(() => { teardown = setup(); });
    return () => { cancelAnimationFrame(raf); teardown(); };
  }, [pathname]);
  return null;
}
