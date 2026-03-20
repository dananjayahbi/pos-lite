'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navGroups = [
  {
    label: 'Overview',
    items: [{ name: 'Dashboard', href: '/dashboard' }],
  },
  {
    label: 'Platform',
    items: [
      { name: 'Tenants', href: '/superadmin/tenants' },
      { name: 'Billing', href: '/superadmin/billing' },
    ],
  },
  {
    label: 'System',
    items: [{ name: 'Health', href: '/superadmin/system' }],
  },
];

export default function SuperAdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      {navGroups.map((group) => (
        <div key={group.label} className="mb-6">
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sand/70">
            {group.label}
          </p>
          <ul className="space-y-1">
            {group.items.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`block rounded-r-md px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'border-l-[3px] border-sand bg-linen/10 text-pearl'
                        : 'border-l-[3px] border-transparent text-pearl/60 hover:text-terracotta'
                    }`}
                  >
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
