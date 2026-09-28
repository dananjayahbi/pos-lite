'use client';

import { useCallback, useRef } from 'react';
import type { TouchEvent } from 'react';

interface UseImageSwipeOptions {
  /** Called when the visitor swipes right (previous image). */
  onPrev: () => void;
  /** Called when the visitor swipes left (next image). */
  onNext: () => void;
  /** Minimum horizontal drag distance (px) for a swipe to register. */
  threshold?: number;
}

/**
 * Lightweight horizontal-swipe detection for image galleries. Returns touch
 * handlers to spread onto the swipeable element. Only handles single-finger
 * horizontal drags with a configurable threshold.
 */
export function useImageSwipe({
  onPrev,
  onNext,
  threshold = 50,
}: UseImageSwipeOptions) {
  const startX = useRef<number | null>(null);

  const onTouchStart = useCallback((e: TouchEvent) => {
    startX.current = e.touches[0]?.clientX ?? null;
  }, []);

  const onTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (startX.current === null) return;
      const endX = e.changedTouches[0]?.clientX;
      if (endX === undefined) {
        startX.current = null;
        return;
      }
      const delta = endX - startX.current;
      if (Math.abs(delta) > threshold) {
        if (delta > 0) onPrev();
        else onNext();
      }
      startX.current = null;
    },
    [onPrev, onNext, threshold],
  );

  return { onTouchStart, onTouchEnd };
}
