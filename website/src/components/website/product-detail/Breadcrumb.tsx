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
    <nav aria-label="Breadcrumb" className="text-sm text-[#94a3b8]">
      <ol className="flex flex-wrap items-center gap-1">
        <li key="home">
          <Link
            href={tenantHomePath(tenantSlug)}
            className="hover:text-[#97c93e] transition-colors"
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
                className="hover:text-[#97c93e] transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-white">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
