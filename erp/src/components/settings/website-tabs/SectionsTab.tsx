'use client';

import React from 'react';
import { Switch } from '@/components/ui/switch';
import { SectionConfigPanel } from './SectionConfigPanels';
import type { WebsiteConfigData, SectionKey } from '@/types/website.types';
import { DEFAULT_SECTION_ORDER } from '@/types/website.types';

interface SectionsTabProps {
  config: WebsiteConfigData;
  onChange: (updates: Partial<WebsiteConfigData>) => void;
}

const SECTION_LABELS: Partial<Record<SectionKey, string>> = {
  hero: 'Hero Banner',
  categories: 'Category Grid',
  solutionsByConcern: 'Solutions by Concern Banner',
  shopByConcern: 'Shop by Concern Carousel',
  giftBox: 'Gift Box Split Section',
  latestProducts: 'Latest Products Carousel',
  promoBanner: 'Promotional Banner',
  bestSelling: 'Best Selling Carousel',
  testimonials: 'Testimonials',
  storesBanner: 'Stores Banner',
  footer: 'Footer',
};

const SECTION_DESCRIPTIONS: Partial<Record<SectionKey, string>> = {
  hero: 'Main hero video/image at the top of the page',
  categories: '4-column grid of product categories',
  solutionsByConcern: 'Centered banner image linking to solutions page',
  shopByConcern: 'Carousel of concern-based shopping categories',
  giftBox: 'Two-column section: image on left, product image on right',
  latestProducts: 'Carousel of the latest products with add-to-cart',
  promoBanner: 'Full-width promotional image banner',
  bestSelling: 'Carousel of best selling products',
  testimonials: 'Auto-rotating customer testimonial slider',
  storesBanner: 'Full-width banner linking to store locations',
  footer: '3-column footer with navigation and about info',
};

export function SectionsTab({ config, onChange }: SectionsTabProps) {
  const sections = (config.sections ?? {}) as Record<string, Record<string, unknown>>;

  const updateSection = (key: SectionKey, updates: Record<string, unknown>) => {
    const existing = (sections[key] as Record<string, unknown>) ?? {};
    onChange({
      sections: {
        ...sections,
        [key]: { isActive: true, sortOrder: DEFAULT_SECTION_ORDER[key], ...existing, ...updates },
      },
    });
  };

  const toggleSection = (key: SectionKey, isActive: boolean) => {
    updateSection(key, { isActive });
  };

  const sectionKeys = Object.keys(SECTION_LABELS) as SectionKey[];

  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold text-espresso">Section Configuration</h3>
        <p className="text-xs text-sand mt-1">
          Toggle sections on/off and configure media, titles, and links for each section.
        </p>
      </div>

      <div className="space-y-4 mt-4">
        {sectionKeys.map((key) => {
          const sectionData = sections[key] as Record<string, unknown> | undefined;
          const isActive = sectionData?.isActive !== false;
          const sortOrder = (sectionData?.sortOrder as number) ?? DEFAULT_SECTION_ORDER[key] ?? 99;

          return (
            <div
              key={key}
              className="border border-mist rounded-lg bg-white overflow-hidden"
            >
              {/* Row header */}
              <div className="flex items-center gap-3 px-4 py-3">
                <span
                  className="flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Switch
                    checked={isActive}
                    onCheckedChange={(checked) => toggleSection(key, checked)}
                  />
                </span>
                <span className="text-xs text-sand w-6 text-center tabular-nums font-mono">{sortOrder}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-espresso">
                    {SECTION_LABELS[key]}
                  </p>
                  <p className="text-xs text-sand truncate">
                    {SECTION_DESCRIPTIONS[key]}
                  </p>
                </div>
              </div>

              {/* Config panel — always visible when active */}
              {isActive && (
                <SectionConfigPanel
                  sectionKey={key}
                  sectionData={sectionData ?? {}}
                  onChange={(updates) => updateSection(key, updates)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
