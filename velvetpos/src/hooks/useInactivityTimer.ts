'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useUIStore } from '@/stores/uiStore';

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

export function useInactivityTimer(timeoutMs = DEFAULT_TIMEOUT_MS) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockScreen = useUIStore((state) => state.lockScreen);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      lockScreen();
    }, timeoutMs);
  }, [lockScreen, timeoutMs]);

  useEffect(() => {
    const events: Array<keyof DocumentEventMap> = ['mousemove', 'keydown', 'touchstart', 'click'];

    events.forEach((eventName) => {
      if (eventName === 'touchstart') {
        document.addEventListener(eventName, resetTimer, { passive: true });
      } else {
        document.addEventListener(eventName, resetTimer);
      }
    });

    resetTimer();

    return () => {
      events.forEach((eventName) => {
        document.removeEventListener(eventName, resetTimer);
      });

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [resetTimer]);

  return { resetTimer };
}
