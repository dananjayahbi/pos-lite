'use client';

import type { ReactNode } from 'react';
import ScreenLockOverlay from '@/components/shared/ScreenLockOverlay';
import { useInactivityTimer } from '@/hooks/useInactivityTimer';

interface StoreLayoutClientProps {
  children: ReactNode;
}

export default function StoreLayoutClient({ children }: StoreLayoutClientProps) {
  const { resetTimer } = useInactivityTimer();

  return (
    <>
      {children}
      <ScreenLockOverlay onUnlock={resetTimer} />
    </>
  );
}
