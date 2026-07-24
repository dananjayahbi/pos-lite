'use client';

import React, { useMemo } from 'react';
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
import type { WebsiteConfigData, SectionKey, WebsiteAdData } from '@/types/website.types';
import { DEFAULT_SECTION_ORDER } from '@/types/website.types';

interface WebsiteShellProps {
  tenantName: string;
  tenantSlug: string;
  config: WebsiteConfigData | null;
}

type SectionConfig = {
  isActive: boolean;
  sortOrder: number;
  [key: string]: unknown;
};

// Each section component receives: config (section-specific JSON), websiteConfig (full config), tenantSlug
type SectionProps = {
  config: Record<string, unknown>;
  websiteConfig: Record<string, unknown>;
  tenantSlug: string;
};

const getSectionComponent = (key: SectionKey): React.ComponentType<SectionProps> | null => {
  const map: Partial<Record<SectionKey, React.ComponentType<SectionProps>>> = {
    hero: HeroSection as unknown as React.ComponentType<SectionProps>,
    categories: CategoryGrid as unknown as React.ComponentType<SectionProps>,
    solutionsByConcern: SolutionsByConcern as unknown as React.ComponentType<SectionProps>,
    shopByConcern: ShopByConcern as unknown as React.ComponentType<SectionProps>,
    giftBox: GiftBoxSection as unknown as React.ComponentType<SectionProps>,
    latestProducts: LatestProducts as unknown as React.ComponentType<SectionProps>,
    promoBanner: PromoBanner as unknown as React.ComponentType<SectionProps>,
    bestSelling: BestSelling as unknown as React.ComponentType<SectionProps>,
    testimonials: TestimonialsSection as unknown as React.ComponentType<SectionProps>,
    storesBanner: StoresBanner as unknown as React.ComponentType<SectionProps>,
    footer: WebsiteFooter as unknown as React.ComponentType<SectionProps>,
  };
  return map[key] ?? null;
};

function getSortedSections(sections: WebsiteConfigData['sections']): Array<{ key: SectionKey; config: SectionConfig }> {
  const entries: Array<{ key: SectionKey; config: SectionConfig }> = [];
  const raw = sections ?? {};
  for (const key of Object.keys(raw) as SectionKey[]) {
    entries.push({ key, config: (raw[key] ?? { isActive: true, sortOrder: DEFAULT_SECTION_ORDER[key] ?? 99 }) as SectionConfig });
  }

  return entries
    .filter(({ config }) => config?.isActive !== false)
    .sort((a, b) => {
      const orderA = a.config?.sortOrder ?? DEFAULT_SECTION_ORDER[a.key] ?? 99;
      const orderB = b.config?.sortOrder ?? DEFAULT_SECTION_ORDER[b.key] ?? 99;
      return orderA - orderB;
    });
}

function getAdsForSection(ads: WebsiteAdData[] | undefined, sectionKey: string): WebsiteAdData[] {
  if (!ads) return [];
  return ads.filter(
    (ad) => ad.position === 'between_sections' && ad.displayAfterSection === sectionKey
  );
}

export function WebsiteShell({ tenantName, tenantSlug, config }: WebsiteShellProps) {
  const websiteConfig: WebsiteConfigData = config ?? {
    siteName: tenantName,
    tagline: '',
    socialLinks: {},
    navItems: [],
    sections: {},
    footerColumns: [],
  };

  const sortedSections = useMemo(
    () => getSortedSections(websiteConfig.sections),
    [websiteConfig.sections]
  );

  const headerAds = useMemo(
    () => (websiteConfig.ads ?? []).filter((ad) => ad.position === 'header'),
    [websiteConfig.ads]
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

        return (
          <React.Fragment key={key}>
            <SectionComponent
              config={sectionConfig as Record<string, unknown>}
              websiteConfig={websiteConfig as unknown as Record<string, unknown>}
              tenantSlug={tenantSlug}
            />
            {/* Inject ads after this section */}
            {getAdsForSection(websiteConfig.ads, key).map((ad) => (
              <AdBanner key={ad.id} ad={ad} />
            ))}
          </React.Fragment>
        );
      })}

      {/* Back to Top */}
      <BackToTop />
    </div>
  );
}
