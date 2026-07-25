'use client';

import React, { useMemo, useEffect } from 'react';
import { WebsiteHeader } from './sections/WebsiteHeader';
import { HeroSection } from './sections/HeroSection';
import { ImageSliderSection } from './sections/ImageSliderSection';
import { BestSelling } from './sections/BestSelling';
import { InfoAdSection } from './sections/InfoAdSection';
import { CategoryGrid } from './sections/CategoryGrid';
import { LatestProducts } from './sections/LatestProducts';
import { TestimonialsSection } from './sections/TestimonialsSection';
import { StoreReferenceSection } from './sections/StoreReferenceSection';
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

/** Format a kebab-case slug into a Title Case display name. */
function formatSlugName(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

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
  latestProducts?: PublicProduct[] | undefined;
  bestSellingProducts?: PublicProduct[] | undefined;
  categories?: PublicCategory[] | undefined;
};

/** Map of section key → component. */
function getSectionComponent(
  key: SectionKey,
): React.ComponentType<SectionProps> | null {
  switch (key) {
    case 'hero':
      return HeroSection as unknown as React.ComponentType<SectionProps>;
    case 'imageSlider':
      return ImageSliderSection as unknown as React.ComponentType<SectionProps>;
    case 'bestSelling':
      return BestSelling as unknown as React.ComponentType<SectionProps>;
    case 'infoAd':
      return InfoAdSection as unknown as React.ComponentType<SectionProps>;
    case 'categories':
      return CategoryGrid as unknown as React.ComponentType<SectionProps>;
    case 'latestProducts':
      return LatestProducts as unknown as React.ComponentType<SectionProps>;
    case 'testimonials':
      return TestimonialsSection as unknown as React.ComponentType<SectionProps>;
    case 'storeReference':
      return StoreReferenceSection as unknown as React.ComponentType<SectionProps>;
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
  const raw = (sections ?? {}) as Record<string, SectionConfig | undefined>;

  // Always iterate ALL known section keys so a section with no stored config
  // still renders with its default isActive + sortOrder values.
  const allKeys = Object.keys(DEFAULT_SECTION_ORDER) as SectionKey[];
  for (const key of allKeys) {
    const stored = raw[key];
    entries.push({
      key,
      config: {
        isActive: true,
        sortOrder: DEFAULT_SECTION_ORDER[key] ?? 99,
        ...stored,
      } as SectionConfig,
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
    siteName: tenantName || formatSlugName(tenantSlug),
    tagline: '',
    socialLinks: {},
    navItems: [],
    sections: {},
    footerColumns: [],
  };

  // Apply dynamic brand colors and typography from ERP config as CSS custom properties
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
    if (websiteConfig.headingFontFamily) {
      root.style.setProperty('--site-heading-font', websiteConfig.headingFontFamily);
    }
    if (websiteConfig.bodyFontFamily) {
      root.style.setProperty('--site-body-font', websiteConfig.bodyFontFamily);
    }
    if (websiteConfig.headingColor) {
      root.style.setProperty('--site-heading-color', websiteConfig.headingColor);
    }
    if (websiteConfig.bodyColor) {
      root.style.setProperty('--site-body-color', websiteConfig.bodyColor);
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
      root.style.removeProperty('--site-heading-font');
      root.style.removeProperty('--site-body-font');
      root.style.removeProperty('--site-heading-color');
      root.style.removeProperty('--site-body-color');
    };
  }, [websiteConfig.primaryColor, websiteConfig.accentColor, websiteConfig.bgColor, websiteConfig.faviconUrl, websiteConfig.metaTitle, websiteConfig.siteName, websiteConfig.headingFontFamily, websiteConfig.bodyFontFamily, websiteConfig.headingColor, websiteConfig.bodyColor]);

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
      {sortedSections.map(({ key, config: sectionConfig }, idx) => {
        const SectionComponent = getSectionComponent(key);
        if (!SectionComponent) return null;

        const sectionProps: SectionProps = {
          config: sectionConfig as Record<string, unknown>,
          websiteConfig: websiteConfig as unknown as Record<string, unknown>,
          tenantSlug,
          latestProducts,
          bestSellingProducts,
          categories,
        };

        // Alternating backgrounds for visual separation
        const isEven = idx % 2 === 0;
        const bgClass = isEven ? 'bg-white' : 'bg-stone-50/60';
        // Hero is full-bleed — only bottom gap, no internal padding
        const isHero = key === 'hero';

        return (
          <div
            key={key}
            className={`section-wrapper ${bgClass} ${isHero ? 'pt-0 pb-0' : 'py-6 md:py-8'} mb-[10px]`}
          >
            <SectionComponent {...sectionProps} />
            {/* Inject ads after this section */}
            {getAdsForSection(websiteConfig.ads, key).map((ad) => (
              <AdBanner key={ad.id} ad={ad} />
            ))}
          </div>
        );
      })}

      {/* Back to Top */}
      <BackToTop />

      {/* Cart drawer (fixed overlay; toggled by header cart icon) */}
      <CartDrawerHost tenantSlug={tenantSlug} />
    </div>
  );
}