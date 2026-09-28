'use client';

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { useRevealOnScroll } from '@/hooks/useRevealOnScroll';

interface DarkCarouselProps {
  /** Unique id for the carousel (used for top-level CSS classes/aria). */
  sliderId: string;
  /** Cards rendered as a horizontal flex track. */
  children: React.ReactNode;
  /** Wrapper class for the overflow-hidden strip. */
  className?: string;
  /** If provided, renders a horizontal progress bar under the track. */
  showProgress?: boolean;
}

/**
 * Full-width horizontal slider used by the Products, Top-Selling mobile,
 * Categories and Latest sections. Matches the reference design:
 *   - glassy flank arrows (50px) inside the strip, vertically centered
 *   - soft left/right gradient edge fades
 *   - optional bottom progress bar (fill 14%–100%)
 * Uses native scroll-snap for swipe gestures.
 */
export function DarkCarousel({
  sliderId,
  children,
  className = '',
  showProgress = true,
}: DarkCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const revealRef = useRevealOnScroll<HTMLDivElement>();
  const [progress, setProgress] = useState(14);

  const updateProgress = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const max = track.scrollWidth - track.clientWidth;
    if (max <= 0) {
      setProgress(100);
      return;
    }
    const pct = Math.min(100, Math.max(14, (track.scrollLeft / max) * 100));
    setProgress(pct);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onScroll = () => updateProgress();
    track.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => track.removeEventListener('scroll', onScroll);
  }, [updateProgress]);

  const scrollByCard = useCallback(
    (dir: 'prev' | 'next') => {
      const track = trackRef.current;
      if (!track) return;
      const first = track.querySelector<HTMLElement>('*');
      const step = (first?.offsetWidth ?? 300) + 24;
      const max = track.scrollWidth - track.clientWidth;

      if (dir === 'next') {
        if (track.scrollLeft >= max - 15) track.scrollTo({ left: 0, behavior: 'smooth' });
        else track.scrollBy({ left: step, behavior: 'smooth' });
      } else {
        if (track.scrollLeft <= 15) track.scrollTo({ left: max, behavior: 'smooth' });
        else track.scrollBy({ left: -step, behavior: 'smooth' });
      }
    },
    [],
  );

  return (
    <div ref={revealRef} className={`relative w-full overflow-hidden ${className}`}>
      {/* Flank arrows */}
      <button
        onClick={() => scrollByCard('prev')}
        aria-label={`${sliderId} previous`}
        className="slider-flank-arrow absolute left-2 sm:left-6 lg:left-8 top-1/2 -translate-y-1/2"
      >
        <i className="fa-solid fa-chevron-left text-sm sm:text-base" />
      </button>
      <button
        onClick={() => scrollByCard('next')}
        aria-label={`${sliderId} next`}
        className="slider-flank-arrow absolute right-2 sm:right-6 lg:right-8 top-1/2 -translate-y-1/2"
      >
        <i className="fa-solid fa-chevron-right text-sm sm:text-base" />
      </button>

      {/* Edge gradient fades */}
      <div className="absolute left-0 top-0 bottom-0 w-8 sm:w-16 lg:w-24 bg-gradient-to-r from-[#051610] to-transparent pointer-events-none z-20" />
      <div className="absolute right-0 top-0 bottom-0 w-8 sm:w-16 lg:w-24 bg-gradient-to-l from-[#051610] to-transparent pointer-events-none z-20" />

      {/* Track */}
      <div
        ref={trackRef}
        className="flex gap-4 sm:gap-6 lg:gap-8 overflow-x-auto no-scrollbar py-6 px-8 sm:px-16 lg:px-24 xl:px-28 scroll-smooth w-full select-none"
      >
        {children}
      </div>

      {/* Progress bar */}
      {showProgress && (
        <div className="w-48 sm:w-64 h-[2px] bg-white/10 rounded-full mx-auto mt-2 overflow-hidden">
          <div
            className="h-full bg-[#97c93e] rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
