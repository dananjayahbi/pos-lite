'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { UserRole } from '@/generated/prisma/client';

import { storeNavGroups, resolveActiveNavHref, type NavItem } from '@/lib/navigation/store-nav';

interface StoreSidebarProps {
  userRole: UserRole;
  permissions: string[];
  businessName: string;
  businessLogoUrl: string | null;
  onNavigate?: () => void;
}

function canAccessItem(item: NavItem, userRole: UserRole, permissions: string[]): boolean {
  if (item.roles && !item.roles.includes(userRole)) {
    return false;
  }

  if (item.permission && !permissions.includes(item.permission)) {
    return false;
  }

  return true;
}

export default function StoreSidebar({
  userRole,
  permissions,
  businessName,
  businessLogoUrl,
  onNavigate,
}: StoreSidebarProps) {
  const pathname = usePathname();

  // Resolve the single active item up front: nested routes match their section
  // item too, and only the most specific href may be highlighted.
  const accessibleItems = storeNavGroups
    .flatMap((group) => group.items)
    .filter((item) => canAccessItem(item, userRole, permissions));
  const activeHref = resolveActiveNavHref(pathname, accessibleItems);

  return (
    <div className="bg-pearl flex h-full flex-col overflow-hidden">
      <div className="border-mist shrink-0 border-b">
        <div
          data-testid="sidebar-header"
          className="flex h-16 items-center gap-2 px-5"
        >
          {businessLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={businessLogoUrl} alt="" className="h-9 w-9 rounded object-contain" />
          ) : null}
          <p className="font-display text-espresso truncate text-xl font-bold">{businessName}</p>
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto scrollbar-none px-3 py-4">
        {storeNavGroups.map((group) => {
          const visibleItems = group.items.filter((item) =>
            canAccessItem(item, userRole, permissions),
          );

          if (visibleItems.length === 0) {
            return null;
          }

          return (
            <div key={group.label} className="mb-6 last:mb-0">
              <p className="text-sand-ink/80 mb-1.5 px-3 text-xs font-semibold tracking-wider uppercase">
                {group.label}
              </p>
              <ul className="flex flex-col">
                {visibleItems.map((item) => {
                  const isActive = item.href === activeHref;

                  const isPosLink =
                    item.href === '/pos' && (userRole === 'OWNER' || userRole === 'MANAGER');

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={isActive ? 'page' : undefined}
                        {...(onNavigate ? { onClick: onNavigate } : {})}
                        {...(isPosLink ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                        className={`flex h-9 items-center rounded-r-md border-l-[3px] px-3 text-sm font-medium transition-colors ${
                          isActive
                            ? 'border-terracotta bg-linen text-espresso'
                            : 'text-espresso/70 hover:bg-linen hover:text-espresso border-transparent'
                        }`}
                      >
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </div>
  );
}
