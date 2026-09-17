import React from 'react';
import { AnnouncementBar } from '../sections/AnnouncementBar';
import { WebsiteHeader } from '../sections/WebsiteHeader';
import { WebsiteFooter } from '../sections/WebsiteFooter';
import { PageHero } from './PageHero';
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
      {/* Site-wide announcement top-bar (req 3.4) — kept identical to the
          main storefront so static pages match the home page. */}
      <AnnouncementBar config={websiteConfig} />

      <WebsiteHeader config={websiteConfig} tenantSlug={tenantSlug} />

      {/* Page title hero */}
      <PageHero
        title={title}
        {...(subtitle ? { subtitle } : {})}
        {...(description ? { description } : {})}
        {...(heroImageUrl ? { heroImageUrl } : {})}
      />

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
