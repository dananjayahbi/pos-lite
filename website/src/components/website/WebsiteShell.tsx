'use client';

import React, { useMemo, useEffect } from 'react';
import { WebsiteHeader } from './sections/WebsiteHeader';
import { HeroSection } from './sections/HeroSection';
import { CategoryGrid } from './sections/CategoryGrid';
import { SolutionsByConcern } from './sections/SolutionsByConcern';
import { ShopByConcern } from './sections/ShopByConcern';
import { GiftBoxSection } from './sections/GiftBoxSection';
import { LatestProducts } from './sections/LatestProducts';
import { PromoBanner } from './sections/PromoBanner';
import { BestSelling } from './sections/BestSelling';
import { TestimonialsSection } from './sections/TestimonialsSection';
import { StoresBanner } from './sections/StoresBanner';
import { WebsiteFooter } from './sections/WebsiteFooter';
import { AdBanner } from './sections/AdBanner';
import { BackToTop } from './sections/BackToTop';
import { CartDrawerHost } from './cart/CartDrawerHost';
import type {
  WebsiteConfigData,
  SectionKey,
  WebsiteAdData,
  PublicProduct,
  PublicCategory,
} from '@/types/website.types';
import { DEFAULT_SECTION_ORDER } from '@/types/website.types';

interface WebsiteShellProps {
  tenantName: string;
  tenantSlug: string;
  config: WebsiteConfigData | null;
  /** Optional real data fetched from ERP API and threaded down to specific sections. */
  latestProducts?: PublicProduct[];
  bestSellingProducts?: PublicProduct[];
  categories?: PublicCategory[];
}

type SectionConfig = {
  isActive: boolean;
  sortOrder: number;
  [key: string]: unknown;
};

/** Every section component receives: section-specific config, full website config, tenantSlug. */
type SectionProps = {
  config: Record<string, unknown>;
  websiteConfig: Record<string, unknown>;
  tenantSlug: string;
  // Optional real data for sections that display products / categories.
  latestProducts?: PublicProduct[];
  bestSellingProducts?: PublicProduct[];
  categories?: PublicCategory[];
};

/** Map of section key → component. Sections that need real data receive it. */
function getSectionComponent(
  key: SectionKey,
): React.ComponentType<SectionProps> | null {
  switch (key) {
    case 'hero':
      return HeroSection as unknown as React.ComponentType<SectionProps>;
    case 'categories':
      return CategoryGrid as unknown as React.ComponentType<SectionProps>;
    case 'solutionsByConcern':
      return SolutionsByConcern as unknown as React.ComponentType<SectionProps>;
    case 'shopByConcern':
      return ShopByConcern as unknown as React.ComponentType<SectionProps>;
    case 'giftBox':
      return GiftBoxSection as unknown as React.ComponentType<SectionProps>;
    case 'latestProducts':
      return LatestProducts as unknown as React.ComponentType<SectionProps>;
    case 'promoBanner':
      return PromoBanner as unknown as React.ComponentType<SectionProps>;
    case 'bestSelling':
      return BestSelling as unknown as React.ComponentType<SectionProps>;
    case 'testimonials':
      return TestimonialsSection as unknown as React.ComponentType<SectionProps>;
    case 'storesBanner':
      return StoresBanner as unknown as React.ComponentType<SectionProps>;
    case 'footer':
      return WebsiteFooter as unknown as React.ComponentType<SectionProps>;
    default:
      return null;
  }
}

function getSortedSections(
  sections: WebsiteConfigData['sections'],
): Array<{ key: SectionKey; config: SectionConfig }> {
  const entries: Array<{ key: SectionKey; config: SectionConfig }> = [];
  const raw = sections ?? {};
  for (const key of Object.keys(raw) as SectionKey[]) {
    entries.push({
      key,
      config: (raw[key] ?? {
        isActive: true,
        sortOrder: DEFAULT_SECTION_ORDER[key] ?? 99,
      }) as SectionConfig,
    });
  }

  return entries
    .filter(({ config }) => config?.isActive !== false)
    .sort((a, b) => {
      const orderA = a.config?.sortOrder ?? DEFAULT_SECTION_ORDER[a.key] ?? 99;
      const orderB = b.config?.sortOrder ?? DEFAULT_SECTION_ORDER[b.key] ?? 99;
      return orderA - orderB;
    });
}

function getAdsForSection(
  ads: WebsiteAdData[] | undefined,
  sectionKey: string,
): WebsiteAdData[] {
  if (!ads) return [];
  return ads.filter(
    (ad) => ad.position === 'between_sections' && ad.displayAfterSection === sectionKey,
  );
}

/**
 * Client orchestrator that renders the header, sorts sections, and injects
 * ads between them. Receives the full website config and (optionally) real
 * product / category data from the ERP API.
 */
export function WebsiteShell({
  tenantName,
  tenantSlug,
  config,
  latestProducts,
  bestSellingProducts,
  categories,
}: WebsiteShellProps) {
  const websiteConfig: WebsiteConfigData = config ?? {
    siteName: tenantName,
    tagline: '',
    socialLinks: {},
    navItems: [],
    sections: {},
    footerColumns: [],
  };

  // Apply dynamic brand colors from ERP config as CSS custom properties
  useEffect(() => {
    const root = document.documentElement;
    if (websiteConfig.primaryColor) {
      root.style.setProperty('--site-primary', websiteConfig.primaryColor);
    }
    if (websiteConfig.accentColor) {
      root.style.setProperty('--site-accent', websiteConfig.accentColor);
    }
    if (websiteConfig.bgColor) {
      root.style.setProperty('--site-bg', websiteConfig.bgColor);
    }

    // Set favicon
    if (websiteConfig.faviconUrl) {
      const link =
        (document.querySelector("link[rel*='icon']") as HTMLLinkElement) ??
        document.createElement('link');
      link.type = 'image/x-icon';
      link.rel = 'shortcut icon';
      link.href = websiteConfig.faviconUrl;
      if (!document.querySelector("link[rel*='icon']")) {
        document.head.appendChild(link);
      }
    }

    // Update page title
    if (websiteConfig.siteName) {
      document.title = websiteConfig.metaTitle || websiteConfig.siteName;
    }

    return () => {
      root.style.removeProperty('--site-primary');
      root.style.removeProperty('--site-accent');
      root.style.removeProperty('--site-bg');
    };
  }, [websiteConfig.primaryColor, websiteConfig.accentColor, websiteConfig.bgColor, websiteConfig.faviconUrl, websiteConfig.metaTitle, websiteConfig.siteName]);

  const sortedSections = useMemo(
    () => getSortedSections(websiteConfig.sections),
    [websiteConfig.sections],
  );

  const headerAds = useMemo(
    () => (websiteConfig.ads ?? []).filter((ad) => ad.position === 'header'),
    [websiteConfig.ads],
  );

  return (
    <div className="site-wrapper">
      {/* Header Ads */}
      {headerAds.map((ad) => (
        <AdBanner key={ad.id} ad={ad} />
      ))}

      {/* Main Header */}
      <WebsiteHeader config={websiteConfig} tenantSlug={tenantSlug} />

      {/* Sections */}
      {sortedSections.map(({ key, config: sectionConfig }) => {
        const SectionComponent = getSectionComponent(key);
        if (!SectionComponent) return null;

        // Pass per-section real data only to sections that consume it.
        const sectionProps: SectionProps = {
          config: sectionConfig as Record<string, unknown>,
          websiteConfig: websiteConfig as unknown as Record<string, unknown>,
          tenantSlug,
        };
        if (key === 'latestProducts' && latestProducts) {
          sectionProps.latestProducts = latestProducts;
        }
        if (key === 'bestSelling' && bestSellingProducts) {
          sectionProps.bestSellingProducts = bestSellingProducts;
        }
        if (key === 'categories' && categories) {
          sectionProps.categories = categories;
        }

        return (
          <React.Fragment key={key}>
            <SectionComponent {...sectionProps} />
            {/* Inject ads after this section */}
            {getAdsForSection(websiteConfig.ads, key).map((ad) => (
              <AdBanner key={ad.id} ad={ad} />
            ))}
          </React.Fragment>
        );
      })}

      {/* Back to Top */}
      <BackToTop />

      {/* Cart drawer (fixed overlay; toggled by header cart icon) */}
      <CartDrawerHost tenantSlug={tenantSlug} />
    </div>
  );
}