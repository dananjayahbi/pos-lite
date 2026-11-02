'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { UserRole } from '@/generated/prisma/client';

import { storeNavGroups, type NavItem } from '@/lib/navigation/store-nav';

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

function isActivePath(
  pathname: string,
  href: string,
  match: 'exact' | 'prefix' = 'prefix',
): boolean {
  if (match === 'exact') {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function formatRole(role: UserRole): string {
  return role.replace(/_/g, ' ');
}

export default function StoreSidebar({
  userRole,
  permissions,
  businessName,
  businessLogoUrl,
  onNavigate,
}: StoreSidebarProps) {
  const pathname = usePathname();

  return (
    <div className="bg-pearl flex h-full flex-col overflow-hidden">
      <div className="shrink-0">
        <div className="px-5 py-5">
          <div className="flex items-center gap-2">
            {businessLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={businessLogoUrl} alt="" className="h-7 w-7 rounded object-contain" />
            ) : null}
            <p className="font-display text-espresso text-xl font-bold">{businessName}</p>
          </div>
          <p className="text-sand mt-1 text-xs font-semibold tracking-[0.2em] uppercase">
            {formatRole(userRole)}
          </p>
        </div>
        <div className="border-mist mx-5 border-b" />
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
              <p className="text-sand/80 mb-1.5 px-3 text-xs font-semibold tracking-wider uppercase">
                {group.label}
              </p>
              <ul className="flex flex-col">
                {visibleItems.map((item) => {
                  const isActive = isActivePath(pathname, item.href, item.match);

                  const isPosLink =
                    item.href === '/pos' && (userRole === 'OWNER' || userRole === 'MANAGER');

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
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
