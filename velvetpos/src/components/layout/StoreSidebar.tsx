'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import type { UserRole } from '@/generated/prisma/client';
import { PERMISSIONS, type PermissionKey } from '@/lib/constants/permissions';

interface NavItem {
  name: string;
  href: string;
  roles?: UserRole[];
  permission?: PermissionKey;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

interface StoreSidebarProps {
  userEmail: string;
  userRole: UserRole;
  permissions: string[];
  onNavigate?: () => void;
}

const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        name: 'Dashboard',
        href: '/dashboard',
        roles: ['OWNER', 'MANAGER', 'STOCK_CLERK'],
      },
      {
        name: 'POS Terminal',
        href: '/pos',
        permission: PERMISSIONS.SALE.createSale,
      },
      {
        name: 'Notifications',
        href: '/notifications',
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      {
        name: 'Inventory',
        href: '/inventory',
        roles: ['OWNER', 'MANAGER', 'STOCK_CLERK'],
        permission: PERMISSIONS.PRODUCT.viewProduct,
      },
      {
        name: 'Stock Control',
        href: '/stock-control',
        roles: ['OWNER', 'MANAGER', 'STOCK_CLERK'],
        permission: PERMISSIONS.STOCK.viewStock,
      },
      {
        name: 'Customers',
        href: '/customers',
        roles: ['OWNER', 'MANAGER', 'CASHIER'],
        permission: PERMISSIONS.CUSTOMER.viewCustomer,
      },
      {
        name: 'Suppliers',
        href: '/suppliers',
        roles: ['OWNER', 'MANAGER', 'STOCK_CLERK'],
        permission: PERMISSIONS.SUPPLIER.viewSupplier,
      },
      {
        name: 'Staff',
        href: '/staff',
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.STAFF.viewStaff,
      },
    ],
  },
  {
    label: 'Growth',
    items: [
      {
        name: 'Promotions',
        href: '/promotions',
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.PROMOTION.createPromotion,
      },
      {
        name: 'Expenses',
        href: '/expenses',
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.EXPENSE.viewExpense,
      },
      {
        name: 'Reports',
        href: '/reports/profit-loss',
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.REPORT.viewSalesReport,
      },
    ],
  },
  {
    label: 'Settings',
    items: [
      {
        name: 'Billing',
        href: '/billing',
        roles: ['OWNER', 'MANAGER'],
        permission: PERMISSIONS.BILLING.viewBilling,
      },
      {
        name: 'Hardware',
        href: '/settings/hardware',
        roles: ['OWNER', 'MANAGER'],
      },
      {
        name: 'Webhooks',
        href: '/settings/webhooks',
        roles: ['OWNER', 'MANAGER'],
      },
      {
        name: 'Audit Log',
        href: '/settings/audit-log',
        roles: ['OWNER', 'MANAGER'],
      },
    ],
  },
];

function canAccessItem(item: NavItem, userRole: UserRole, permissions: string[]): boolean {
  if (item.roles && !item.roles.includes(userRole)) {
    return false;
  }

  if (item.permission && !permissions.includes(item.permission)) {
    return false;
  }

  return true;
}

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function formatRole(role: UserRole): string {
  return role.replace(/_/g, ' ');
}

export default function StoreSidebar({
  userEmail,
  userRole,
  permissions,
  onNavigate,
}: StoreSidebarProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col justify-between bg-pearl">
      <div>
        <div className="px-5 py-5">
          <p className="font-display text-xl font-bold text-espresso">VelvetPOS</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-sand">
            {formatRole(userRole)}
          </p>
        </div>
        <div className="mx-5 border-b border-mist" />

        <nav className="px-3 py-4">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter((item) =>
              canAccessItem(item, userRole, permissions),
            );

            if (visibleItems.length === 0) {
              return null;
            }

            return (
              <div key={group.label} className="mb-6 last:mb-0">
                <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sand/80">
                  {group.label}
                </p>
                <ul className="space-y-1">
                  {visibleItems.map((item) => {
                    const isActive = isActivePath(pathname, item.href);

                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          {...(onNavigate ? { onClick: onNavigate } : {})}
                          className={`block rounded-r-md border-l-[3px] px-3 py-2 text-sm font-medium transition-colors ${
                            isActive
                              ? 'border-terracotta bg-linen text-espresso'
                              : 'border-transparent text-espresso/70 hover:bg-linen hover:text-espresso'
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

      <div className="border-t border-mist px-4 py-4">
        <p className="truncate text-xs text-sand">{userEmail}</p>
        <button
          type="button"
          onClick={() => {
            void signOut({ callbackUrl: '/login' });
          }}
          className="mt-2 text-xs text-terracotta transition-colors hover:text-espresso"
        >
          Log Out
        </button>
      </div>
    </div>
  );
}