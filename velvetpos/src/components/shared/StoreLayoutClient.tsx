'use client';

import { useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
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
      <div className="fixed right-4 top-4 z-50">
        <NotificationPopover />
      </div>

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
