'use client';

import { Lock } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import PinEntryModal from '@/components/shared/PinEntryModal';
import { useUIStore } from '@/stores/uiStore';

interface ScreenLockOverlayProps {
  onUnlock: () => void;
}

export default function ScreenLockOverlay({ onUnlock }: ScreenLockOverlayProps) {
  const { data: session, update } = useSession();
  const isScreenLocked = useUIStore((state) => state.isScreenLocked);
  const unlockScreen = useUIStore((state) => state.unlockScreen);

  if (!isScreenLocked) {
    return null;
  }

  const handleSuccess = async () => {
    const refreshedSession = await update();
    if (!refreshedSession?.user) {
      await signOut({ callbackUrl: '/login' });
      return;
    }

    unlockScreen();
    onUnlock();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-espresso/90 px-4">
      <div className="w-full max-w-md rounded-xl border border-mist bg-linen p-6 shadow-xl">
        <div className="mb-4 text-center">
          <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-espresso text-pearl">
            <Lock size={20} />
          </div>
          <h2 className="font-display text-3xl text-espresso">Screen Locked</h2>
          <p className="mt-1 text-sm text-text-muted">
            {session?.user.email ?? 'Current user'}
            {session?.user.role ? ` • ${session.user.role}` : ''}
          </p>
        </div>

        <PinEntryModal
          isOverlay={false}
          userDisplayName={session?.user.email ?? 'Current user'}
          userEmail={session?.user.email ?? ''}
          onSuccess={handleSuccess}
        />

        <div className="mt-4 text-center">
          <button
            className="text-sm text-terracotta hover:underline"
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
          >
            Sign out instead
          </button>
        </div>
      </div>
    </div>
  );
}
