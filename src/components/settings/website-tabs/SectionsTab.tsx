'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import type { WebsiteConfigData, SectionKey } from '@/types/website.types';
import { DEFAULT_SECTION_ORDER } from '@/types/website.types';

interface SectionsTabProps {
  config: WebsiteConfigData;
  onChange: (updates: Partial<WebsiteConfigData>) => void;
}

const SECTION_LABELS: Record<SectionKey, string> = {
  hero: 'Hero Slider/Video',
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
  hero: 'Main hero video/image slider at the top of the page',
  categories: '4-column masonry grid of product categories',
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

  const updateTitle = (key: SectionKey, title: string) => {
    updateSection(key, { title });
  };

  const sectionKeys = Object.keys(SECTION_LABELS) as SectionKey[];

  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold text-espresso">Section Visibility & Order</h3>
        <p className="text-xs text-sand mt-1">
          Toggle sections on/off. Active sections appear in sort order. Footer is always last.
        </p>
      </div>

      <div className="space-y-1 mt-4">
        {sectionKeys.map((key) => {
          const sectionData = sections[key] as Record<string, unknown> | undefined;
          const isActive = sectionData?.isActive !== false;
          const sortOrder = (sectionData?.sortOrder as number) ?? DEFAULT_SECTION_ORDER[key] ?? 99;
          const title = (sectionData?.title as string) ?? '';

          return (
            <div
              key={key}
              className="flex items-center gap-4 p-3 border border-mist rounded-lg bg-white"
            >
              <div className="flex items-center gap-2">
                <Switch
                  checked={isActive}
                  onCheckedChange={(checked) => toggleSection(key, checked)}
                />
              </div>
              <span className="text-xs text-sand w-8 text-center">{sortOrder}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-espresso">
                  {SECTION_LABELS[key]}
                </p>
                {SECTION_DESCRIPTIONS[key] && (
                  <p className="text-xs text-sand truncate">
                    {SECTION_DESCRIPTIONS[key]}
                  </p>
                )}
              </div>
              {/* Title input for sections that support it */}
              {['categories', 'shopByConcern', 'latestProducts', 'bestSelling', 'testimonials'].includes(key) && (
                <Input
                  value={title}
                  onChange={(e) => updateTitle(key, e.target.value)}
                  placeholder="Section title"
                  className="h-7 text-xs w-40 hidden md:block"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
