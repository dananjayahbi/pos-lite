import React from 'react';
import { WebsiteHeader } from '../sections/WebsiteHeader';
import { WebsiteFooter } from '../sections/WebsiteFooter';
import type { WebsiteConfigData } from '@/types/website.types';

interface StaticPageShellProps {
  tenantName: string;
  tenantSlug: string;
  config?: WebsiteConfigData | null | undefined;
  title: string;
  subtitle?: string;
  description?: string;
  children: React.ReactNode;
}

const DEFAULT_CONFIG: WebsiteConfigData = {
  socialLinks: {},
  navItems: [],
  sections: {},
  footerColumns: [],
};

/**
 * Shared layout for static CMS-like pages (About, Contact, etc.).
 * Uses the consistent WebsiteHeader + WebsiteFooter from the main site.
 */
export function StaticPageShell({
  tenantName,
  tenantSlug,
  config,
  title,
  subtitle,
  description,
  children,
}: StaticPageShellProps) {
  const websiteConfig: WebsiteConfigData = config ?? {
    ...DEFAULT_CONFIG,
    siteName: tenantName,
  };

  return (
    <div className="site-wrapper">
      <WebsiteHeader config={websiteConfig} tenantSlug={tenantSlug} />

      {/* Page title hero */}
      <section className="bg-[var(--site-light-gray,#f5f5f5)] border-b border-black/5">
        <div className="max-w-5xl mx-auto px-4 py-16 md:py-20 text-center">
          <h1
            className="text-3xl md:text-5xl font-medium tracking-tight text-[var(--site-primary,#0a0a0a)]"
            style={{ fontFamily: 'var(--font-dm-serif), serif' }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 text-sm md:text-base text-gray-500 max-w-lg mx-auto">
              {subtitle}
            </p>
          )}
          {description && (
            <p className="mt-2 text-sm text-gray-400 max-w-xl mx-auto">
              {description}
            </p>
          )}
        </div>
      </section>

      {/* Page content */}
      <main className="max-w-5xl mx-auto px-4 py-12 md:py-16">
        {children}
      </main>

      {/* Footer */}
      <WebsiteFooter
        config={{}}
        websiteConfig={websiteConfig}
        tenantSlug={tenantSlug}
      />
    </div>
  );
}
