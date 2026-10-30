'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface DropdownAnchorRect {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  /** True when the dropdown had to open upwards to stay on screen. */
  flipped: boolean;
}

const GAP = 4;
const MIN_HEIGHT = 120;
const MAX_HEIGHT = 320;

export interface DropdownAnchorBox {
  top: number;
  bottom: number;
  left: number;
  width: number;
}

/**
 * Pure geometry for a portal dropdown. Kept separate from the hook so the
 * clamping/flip rules can be unit tested without a DOM.
 */
export function computeDropdownRect(
  box: DropdownAnchorBox,
  viewportHeight: number,
): DropdownAnchorRect {
  const spaceBelow = viewportHeight - box.bottom - GAP;
  const spaceAbove = box.top - GAP;
  const flipped = spaceBelow < MIN_HEIGHT && spaceAbove > spaceBelow;
  const available = flipped ? spaceAbove : spaceBelow;
  return {
    top: flipped ? box.top - GAP : box.bottom + GAP,
    left: box.left,
    width: box.width,
    maxHeight: Math.max(MIN_HEIGHT, Math.min(available, MAX_HEIGHT)),
    flipped,
  };
}

/**
 * Positions a portal-rendered dropdown against an input's on-screen rect.
 *
 * Absolutely-positioned dropdowns get clipped by any `overflow-hidden` ancestor
 * (cards, sheets, scroll containers) and can run off the bottom of the viewport.
 * Rendering through a portal with `position: fixed` escapes the clipping; this
 * hook works out where to put it and how tall it may grow, flipping above the
 * input when there is more room up there.
 */
export function useDropdownAnchor(open: boolean) {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [rect, setRect] = useState<DropdownAnchorRect | null>(null);

  const measure = useCallback(() => {
    const node = anchorRef.current;
    if (!node) return;
    setRect(computeDropdownRect(node.getBoundingClientRect(), window.innerHeight));
  }, []);

  // Measure as soon as the node is attached so the first open needs no extra
  // paint, then keep tracking it while it moves or the window resizes.
  const setAnchor = useCallback(
    (node: HTMLDivElement | null) => {
      anchorRef.current = node;
      if (node) measure();
    },
    [measure],
  );

  useEffect(() => {
    if (!open) return;
    // Capture phase so scrolls inside nested containers are seen too.
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [open, measure]);

  return { setAnchor, rect, measure };
}

/**
 * Inline style for the portal panel. When flipped the panel is anchored by its
 * bottom edge so its height can grow upward without being recalculated.
 */
export function dropdownPanelStyle(rect: DropdownAnchorRect): React.CSSProperties {
  return rect.flipped
    ? { position: 'fixed', bottom: window.innerHeight - rect.top, left: rect.left, width: rect.width }
    : { position: 'fixed', top: rect.top, left: rect.left, width: rect.width };
}
