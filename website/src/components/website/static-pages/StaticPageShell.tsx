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
        className="relative pt-[112px] border-b border-white/5 overflow-hidden"
        style={
          heroImageUrl
            ? {
                backgroundImage: `url(${heroImageUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                minHeight: '480px',
              }
            : { backgroundColor: 'rgba(5, 22, 16, 0.95)' }
        }
      >
        {/* Vignette overlay for readability */}
        {heroImageUrl && (
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 50% 50%, rgba(5,22,16,0.4) 0%, rgba(5,22,16,0.85) 65%, #051610 100%)',
            }}
          />
        )}
        <div className="relative z-10 max-w-5xl mx-auto px-6 py-16 md:py-24 text-center">
          <h1
            className="text-3xl md:text-5xl font-cinzel font-extrabold tracking-wide text-white leading-tight"
            style={{ fontFamily: 'var(--font-serif), serif' }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 text-sm md:text-base text-[#cbd5e1] font-light max-w-lg mx-auto">
              {subtitle}
            </p>
          )}
          {description && (
            <p className="mt-2 text-sm text-[#94a3b8] max-w-xl mx-auto">{description}</p>
          )}
          <div className="w-16 h-[2px] bg-[#97c93e]/60 mx-auto mt-6 rounded-full" />
        </div>
      </section>

      {/* Page content */}
      <main className="max-w-7xl mx-auto px-6 py-12 md:py-16">
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
