import React from 'react';
import Link from 'next/link';
import { tenantHomePath } from '@/lib/tenant';
import type { WebsiteConfigData } from '@/types/website.types';

interface StaticPageShellProps {
  tenantName: string;
  tenantSlug: string;
  config?: WebsiteConfigData | null | undefined;
  title: string;
  description?: string;
  children: React.ReactNode;
}

/**
 * Shared layout for static CMS-like pages (About, Contact, etc.).
 * Provides a consistent header, title section, and footer.
 */
export function StaticPageShell({
  tenantName,
  tenantSlug,
  config,
  title,
  description,
  children,
}: StaticPageShellProps) {
  const homeHref = tenantHomePath(tenantSlug);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3">
          <Link
            href={homeHref}
            className="text-lg font-medium"
            style={{ fontFamily: 'var(--font-dm-serif), serif' }}
          >
            {tenantName}
          </Link>
          <Link
            href={homeHref}
            className="text-sm text-gray-500 hover:text-black transition-colors"
          >
            ← Back to store
          </Link>
        </div>
      </header>

      {/* Page content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Page title */}
        <div className="mb-10 text-center">
          <h1
            className="text-3xl md:text-4xl font-medium mb-3"
            style={{ fontFamily: 'var(--font-dm-serif), serif' }}
          >
            {title}
          </h1>
          {description && (
            <p className="text-gray-500 text-sm max-w-xl mx-auto">
              {description}
            </p>
          )}
          <div className="mt-4 mx-auto w-16 h-px bg-gray-300" />
        </div>

        {children}
      </main>

      {/* Footer */}
      {config && (
        <footer className="border-t border-gray-100 py-8">
          <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500">
            <p>
              © {new Date().getFullYear()} {config.siteName || tenantName}. All
              rights reserved.
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}
