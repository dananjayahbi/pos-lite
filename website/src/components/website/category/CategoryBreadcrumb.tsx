import React from 'react';
import Link from 'next/link';
import { tenantHomePath } from '@/lib/tenant';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface CategoryBreadcrumbProps {
  items: BreadcrumbItem[];
  tenantSlug: string;
}

/**
 * Breadcrumb navigation for category pages.
 */
export function CategoryBreadcrumb({ items, tenantSlug }: CategoryBreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-gray-500">
      <ol className="flex flex-wrap items-center gap-1">
        <li>
          <Link
            href={tenantHomePath(tenantSlug)}
            className="hover:text-black transition-colors"
          >
            Home
          </Link>
        </li>
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-1">
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
