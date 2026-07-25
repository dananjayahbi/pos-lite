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
  heroImageUrl?: string;
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
  heroImageUrl,
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
      <section
        className="relative border-b border-black/5 overflow-hidden"
        style={
          heroImageUrl
            ? { backgroundImage: `url(${heroImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : { backgroundColor: 'var(--site-light-gray, #f5f5f5)' }
        }
      >
        {/* Dark overlay for readability when hero image is set */}
        {heroImageUrl && (
          <div className="absolute inset-0 bg-black/40" />
        )}
        <div className="relative max-w-5xl mx-auto px-4 py-16 md:py-24 text-center">
          <h1
            className={`text-3xl md:text-5xl font-medium tracking-tight ${
              heroImageUrl ? 'text-white' : 'text-[var(--site-primary,#0a0a0a)]'
            }`}
            style={{ fontFamily: 'var(--font-dm-serif), serif' }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className={`mt-3 text-sm md:text-base max-w-lg mx-auto ${
                heroImageUrl ? 'text-white/80' : 'text-gray-500'
              }`}
            >
              {subtitle}
            </p>
          )}
          {description && (
            <p
              className={`mt-2 text-sm max-w-xl mx-auto ${
                heroImageUrl ? 'text-white/60' : 'text-gray-400'
              }`}
            >
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
