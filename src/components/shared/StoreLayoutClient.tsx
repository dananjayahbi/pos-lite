'use client';

import { useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import type { UserRole } from '@/generated/prisma/client';
import StoreSidebar from '@/components/layout/StoreSidebar';
import ScreenLockOverlay from '@/components/shared/ScreenLockOverlay';
import { NotificationPopover } from '@/components/notifications/NotificationPopover';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useInactivityTimer } from '@/hooks/useInactivityTimer';
import { MenuIcon } from 'lucide-react';

interface StoreLayoutClientProps {
  children: ReactNode;
  userEmail: string;
  userRole: UserRole;
  permissions: string[];
}

export default function StoreLayoutClient({
  children,
  userEmail,
  userRole,
  permissions,
}: StoreLayoutClientProps) {
  const { resetTimer } = useInactivityTimer();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const showSidebar = !pathname.startsWith('/pos');

  return (
    <>
      {showSidebar ? (
        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-64 shrink-0 border-r border-mist bg-pearl md:flex">
            <StoreSidebar
              userEmail={userEmail}
              userRole={userRole}
              permissions={permissions}
            />
          </aside>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {/* Desktop header */}
            <header className="sticky top-0 z-40 hidden items-center justify-between border-b border-mist bg-pearl/95 px-6 py-3 backdrop-blur-sm md:flex">
              <div />
              <div className="flex items-center gap-3">
                <NotificationPopover />
                <span className="max-w-[180px] truncate rounded-full bg-linen px-3 py-1 text-xs text-espresso/70">
                  {userEmail}
                </span>
                <button
                  type="button"
                  onClick={() => void signOut({ callbackUrl: '/login' })}
                  className="text-xs text-terracotta transition-colors hover:text-espresso"
                >
                  Log Out
                </button>
              </div>
            </header>

            {/* Mobile header */}
            <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-mist bg-pearl px-4 py-3 md:hidden">
              <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Open navigation menu">
                    <MenuIcon className="h-5 w-5 text-espresso" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 bg-pearl p-0">
                  <SheetTitle className="sr-only">Store navigation</SheetTitle>
                  <StoreSidebar
                    userEmail={userEmail}
                    userRole={userRole}
                    permissions={permissions}
                    onNavigate={() => setMobileNavOpen(false)}
                  />
                </SheetContent>
              </Sheet>

              <div>
                <p className="font-display text-lg font-bold text-espresso">VelvetPOS</p>
                <p className="text-xs uppercase tracking-[0.2em] text-sand">{userRole.replace(/_/g, ' ')}</p>
              </div>
            </header>

            <main id="main-content" className="min-w-0 flex-1 overflow-x-hidden bg-linen">
              {children}
            </main>
          </div>
        </div>
      ) : (
        <main id="main-content" className="min-h-screen bg-linen">
          {children}
        </main>
      )}

      <ScreenLockOverlay onUnlock={resetTimer} />
    </>
  );
}
