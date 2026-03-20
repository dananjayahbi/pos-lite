'use client';

import type { ReactNode } from 'react';
import ScreenLockOverlay from '@/components/shared/ScreenLockOverlay';
import { NotificationPopover } from '@/components/notifications/NotificationPopover';
import { useInactivityTimer } from '@/hooks/useInactivityTimer';

interface StoreLayoutClientProps {
  children: ReactNode;
}

export default function StoreLayoutClient({ children }: StoreLayoutClientProps) {
  const { resetTimer } = useInactivityTimer();

  return (
    <>
      <div className="fixed right-4 top-4 z-50">
        <NotificationPopover />
      </div>
      {children}
      <ScreenLockOverlay onUnlock={resetTimer} />
    </>
  );
}
