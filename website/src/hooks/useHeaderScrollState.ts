'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Scroll state for the fixed storefront header.
 *
 * The header is `position: fixed` and offsets itself below the announcement
 * top-bar via `top: var(--announcement-bar-height)`. That offset is only
 * correct while the bar is still on screen — the bar itself is in NORMAL
 * flow and scrolls away, so leaving the offset in place after the first
 * scroll leaves a transparent gap between the viewport's top edge and the
 * header. This hook reports when the bar has been scrolled past so the
 * header can take that space (offset → 0).
 *
 * Two independent signals, because they drive different effects:
 *
 *   - `announcementOffset` → the header's `top`, in px. Tracks the bar
 *     continuously: `barHeight - scrollY`, clamped at 0. While the bar is
 *     half-scrolled the header rises with it, and once the bar is gone the
 *     offset is 0 and the header occupies the top edge. There is no scroll
 *     position at which the gap is non-zero.
 *
 *   - `condensed` → the shrink + frosted-glass treatment. True when the
 *     viewport is scrolled past `scrollThreshold` OR the announcement bar has
 *     begun to move up under the header, so the header is already in its glass
 *     state before the bar fully clears.
 *
 * The bar height is read from the CSS custom property published by
 * `<AnnouncementBar>` rather than hard-coded, so it stays correct when the bar
 * wraps to two lines on narrow screens. A site with no announcement publishes
 * `0px`, which collapses the offset to 0 immediately and reproduces the
 * pre-feature layout exactly.
 */

/** Distance, in px of document scroll, at which the header condenses. */
const DEFAULT_SCROLL_THRESHOLD = 40;

function readAnnouncementBarHeight(): number {
  const raw = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue('--announcement-bar-height')
    .trim();

  if (!raw) {
    // Variable missing entirely — measure the element directly.
    const el = document.getElementById('announcement-bar');
    return el ? el.getBoundingClientRect().height : 0;
  }

  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export interface HeaderScrollState {
  /**
   * True once the header should switch to its condensed treatment (shrink +
   * frosted glass): either the viewport is scrolled past `scrollThreshold`,
   * or the announcement bar has started to move up under it.
   */
  condensed: boolean;
  /**
   * Distance the header should sit below the top edge, in px. Equals the part
   * of the announcement bar still on screen, and 0 once it has scrolled past.
   */
  announcementOffset: number;
}

export function useHeaderScrollState(
  scrollThreshold: number = DEFAULT_SCROLL_THRESHOLD,
): HeaderScrollState {
  const [condensed, setCondensed] = useState(false);
  const [announcementOffset, setAnnouncementOffset] = useState(0);

  // Cached bar height, re-measured on resize only: reading it on every scroll
  // event would force a style recalculation per frame.
  const barHeightRef = useRef(0);

  useEffect(() => {
    const evaluate = () => {
      const y = window.scrollY;
      // Rounded to avoid sub-pixel churn from a fractional scroll position.
      const offset = Math.max(0, Math.round(barHeightRef.current - y));
      setAnnouncementOffset((prev) => (prev === offset ? prev : offset));

      // The bar only lifts off the top edge once the page is scrolled, so a
      // site with no announcement always keys off the plain threshold.
      const isCondensed =
        y > scrollThreshold || (barHeightRef.current > 0 && y > 0);
      setCondensed((prev) => (prev === isCondensed ? prev : isCondensed));
    };

    const onResize = () => {
      barHeightRef.current = readAnnouncementBarHeight();
      evaluate();
    };

    // Measure before the first evaluation. `<AnnouncementBar>` publishes the
    // variable in an effect that runs before this one (it is the earlier
    // sibling in the shell), so the value is already correct here.
    barHeightRef.current = readAnnouncementBarHeight();
    evaluate();

    window.addEventListener('scroll', evaluate, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', evaluate);
      window.removeEventListener('resize', onResize);
    };
  }, [scrollThreshold]);

  return { condensed, announcementOffset };
}
