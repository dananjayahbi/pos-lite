'use client';

import { useEffect, useRef, type RefObject } from 'react';

/**
 * IntersectionObserver-driven scroll reveal.
 *
 * Mirrors the reference design's `.reveal-on-scroll` behaviour:
 *   - element starts at `opacity:0; translateY(30px)`
 *   - when it crosses the viewport (threshold 0.05, rootMargin -30px bottom)
 *     we add the `.revealed` class → animates to `opacity:1; translateY(0)`
 *   - one-way: never un-reveals.
 */
export function useRevealOnScroll<T extends HTMLElement>(
  threshold = 0.05,
  rootMargin = '0px 0px -30px 0px',
): RefObject<T | null> {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.classList.add('reveal-on-scroll');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            // Once revealed, stop observing.
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold, rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return ref;
}

/**
 * 3D tilt interaction for a card / image frame.
 *
 * When the wrapped ref is hovered it applies a perspective transform,
 * following the cursor with configurable intensity. On leave it resets.
 * Only active on non-touch devices (matches the reference design).
 */
export function useTilt<T extends HTMLElement>(
  intensity = 8,
): RefObject<T | null> {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Skip on touch devices.
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) return;

    const onMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const rotateX = py * -intensity;
      const rotateY = px * intensity;
      el.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px) scale3d(1.02,1.02,1.02)`;
    };

    const onMouseLeave = () => {
      el.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateY(0) scale3d(1,1,1)';
    };

    el.addEventListener('mousemove', onMouseMove);
    el.addEventListener('mouseleave', onMouseLeave);
    return () => {
      el.removeEventListener('mousemove', onMouseMove);
      el.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [intensity]);

  return ref;
}
