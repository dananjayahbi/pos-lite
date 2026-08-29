'use client';

import { useEffect } from 'react';

/**
 * Global parallax + reveal engine.
 *
 * Runs a requestAnimationFrame-throttled scroll loop and animates every node
 * carrying one of the decorative classes used across the reference design:
 *
 *   - `.parallax-leaf`   → vertical drift (clamped ±45px) + rotation (±20deg)
 *   - `.ambient-glow`    → vertical drift (clamped ±30px)
 *   - `.spotlight-halo`  → vertical drift (clamped ±30px)
 *   - `.spotlight-img`   → scale(1.06) + vertical drift (clamped ±20px)
 *
 * It also adds the `hero-bg-container` / `hero-section-content` hero parallax and
 * a `.revealed` class to any `.reveal-on-scroll` element via IntersectionObserver.
 *
 * Mount this once per page (e.g. in WebsiteShell).
 */
export function useParallaxEngine(): void {
  useEffect(() => {
    let ticking = false;

    // ── Reveal-on-scroll ──────────────────────────────────────────────────
    const revealElements = document.querySelectorAll<HTMLElement>('.reveal-on-scroll');
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.05, rootMargin: '0px 0px -30px 0px' },
    );
    revealElements.forEach((el) => revealObserver.observe(el));

    // ── Scroll parallax ───────────────────────────────────────────────────
    const updateParallax = () => {
      const windowH = window.innerHeight;
      const scrollY = window.scrollY;

      // Hero drift (only while hero is visible)
      const heroBg = document.querySelector<HTMLElement>('#hero-bg-container');
      if (heroBg && scrollY < windowH) {
        heroBg.style.transform = `translate3d(0, ${scrollY * 0.25}px, 0) scale(${Math.min(1.08, 1 + scrollY * 0.0001)})`;
      }
      // Static-page hero (About/Contact) background drift
      const pageHeroBg = document.querySelector<HTMLElement>('#page-hero-bg-container');
      if (pageHeroBg && scrollY < windowH) {
        const speed = parseFloat(pageHeroBg.dataset.parallax || '0.25');
        pageHeroBg.style.transform = `translate3d(0, ${scrollY * speed}px, 0) scale(${Math.min(1.08, 1 + scrollY * 0.0001)})`;
      }
      const heroContent = document.querySelector<HTMLElement>('#hero-content');
      if (heroContent && scrollY < windowH) {
        heroContent.style.transform = `translate3d(0, ${-scrollY * 0.15}px, 0)`;
      }

      // Per-section decorative elements
      document.querySelectorAll<HTMLElement>('.parallax-leaf').forEach((leaf, idx) => {
        const rect = leaf.getBoundingClientRect();
        // Only when the element is (near) visible
        if (rect.top > windowH + 150 || rect.bottom < -150) return;

        const speed = parseFloat(leaf.dataset.speed || String(0.12 * (idx + 1)));
        const relativeCenter = rect.top - windowH / 2 + rect.height / 2;
        const rawShift = relativeCenter * speed * -0.4;
        const shiftY = Math.max(-45, Math.min(45, rawShift));
        const rotate = Math.max(
          -20,
          Math.min(20, relativeCenter * 0.03 * (idx % 2 === 0 ? 1 : -1)),
        );
        leaf.style.transform = `translate3d(0, ${shiftY}px, 0) rotate(${rotate}deg)`;
      });

      document
        .querySelectorAll<HTMLElement>('.ambient-glow, .spotlight-halo')
        .forEach((glow, idx) => {
          const rect = glow.getBoundingClientRect();
          if (rect.top > windowH + 150 || rect.bottom < -150) return;

          const speed = 0.08 * (idx + 1);
          const relativeCenter = rect.top - windowH / 2 + rect.height / 2;
          const rawShift = relativeCenter * speed * 0.3;
          const shiftY = Math.max(-30, Math.min(30, rawShift));
          glow.style.transform = `translate3d(0, ${shiftY}px, 0)`;
        });

      // Spotlight image drift
      document.querySelectorAll<HTMLElement>('.spotlight-img').forEach((img) => {
        const rect = img.getBoundingClientRect();
        if (rect.top > windowH + 150 || rect.bottom < -150) return;
        const relativeCenter = rect.top - windowH / 2 + rect.height / 2;
        const shiftY = Math.max(-20, Math.min(20, relativeCenter * -0.04));
        img.style.transform = `scale(1.06) translateY(${shiftY}px)`;
      });

      // Store reference bg drift
      document.querySelectorAll<HTMLElement>('.store-bg-layer').forEach((bg) => {
        const rect = bg.getBoundingClientRect();
        if (rect.top > windowH + 150 || rect.bottom < -150) return;
        const relativeCenter = rect.top - windowH / 2 + rect.height / 2;
        bg.style.transform = `translate3d(0, ${relativeCenter * 0.1}px, 0)`;
      });

      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateParallax);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    updateParallax();

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      revealObserver.disconnect();
    };
  }, []);
}
