'use client';

import { useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import type { UserRole } from '@/generated/prisma/client';
import StoreSidebar from '@/components/layout/StoreSidebar';
import { NotificationPopover } from '@/components/notifications/NotificationPopover';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { MenuIcon } from 'lucide-react';

interface StoreLayoutClientProps {
  children: ReactNode;
  userEmail: string;
  userRole: UserRole;
  permissions: string[];
  businessName: string;
  businessLogoUrl: string | null;
}

export default function StoreLayoutClient({
  children,
  userEmail,
  userRole,
  permissions,
  businessName,
  businessLogoUrl,
}: StoreLayoutClientProps) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const showSidebar = !pathname.startsWith('/pos');

  return (
    <>
      {showSidebar ? (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <aside className="hidden w-64 shrink-0 overflow-hidden border-r border-mist bg-pearl md:flex">
            <StoreSidebar
              userEmail={userEmail}
              userRole={userRole}
              permissions={permissions}
              businessName={businessName}
              businessLogoUrl={businessLogoUrl}
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
                  onClick={() => void signOut({ callbackUrl: `${window.location.origin}/login` })}
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
                    businessName={businessName}
                    businessLogoUrl={businessLogoUrl}
                    onNavigate={() => setMobileNavOpen(false)}
                  />
                </SheetContent>
              </Sheet>

              <div className="flex items-center gap-2">
                {businessLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={businessLogoUrl} alt="" className="h-6 w-6 rounded object-contain" />
                ) : null}
                <div>
                  <p className="font-display text-lg font-bold text-espresso">{businessName}</p>
                  <p className="text-xs uppercase tracking-[0.2em] text-sand">{userRole.replace(/_/g, ' ')}</p>
                </div>
              </div>
            </header>

            <main id="main-content" className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-linen">
              {children}
            </main>
          </div>
        </div>
      ) : (
        <main id="main-content" className="min-h-screen bg-linen">
          {children}
        </main>
      )}
    </>
  );
}
