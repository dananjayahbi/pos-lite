import React from 'react';
import Link from 'next/link';
import { tenantHomePath } from '@/lib/tenant';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  tenantSlug: string;
}

/**
 * Simple breadcrumb navigation.
 */
export function Breadcrumb({ items, tenantSlug }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-gray-500">
      <ol className="flex flex-wrap items-center gap-1">
        <li key="home">
          <Link
            href={tenantHomePath(tenantSlug)}
            className="hover:text-black transition-colors"
          >
            Home
          </Link>
        </li>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-1">
            <span>/</span>
            {item.href ? (
              <Link
                href={item.href}
                className="hover:text-black transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-black">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
