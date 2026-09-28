'use client';

import { useEffect, useState } from 'react';

/**
 * Returns `true` once the component has mounted on the client.
 *
 * Use to guard against SSR hydration mismatches caused by values that differ
 * between the server and the client — e.g. a `new Date()` "today" snapshot,
 * `Math.random()`, or timezone-dependent formatting. The component renders the
 * same deterministic tree on the server and during the first client render,
 * then swaps in the client-only value after mount.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}
