'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DeferredMediaUploader } from '@/components/shared/DeferredMediaUploader';
import type { SectionKey } from '@/types/website.types';

// ── Types ────────────────────────────────────────────────────────────────────

interface SectionConfigPanelProps {
  sectionKey: SectionKey;
  sectionData: Record<string, unknown>;
  onChange: (updates: Record<string, unknown>) => void;
}

// ── Field helpers ────────────────────────────────────────────────────────────

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-sand">{label}</Label>
      {children}
    </div>
  );
}

// ── Per-section panels ──────────────────────────────────────────────────────

function CategoriesConfig({ sectionData, onChange }: Omit<SectionConfigPanelProps, 'sectionKey'>) {
  return (
    <div className="space-y-3">
      <FieldRow label="Section Title">
        <Input
          value={(sectionData.title as string) ?? ''}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="e.g. Shop by Category"
          className="h-8 text-xs"
        />
      </FieldRow>
      <p className="text-[11px] text-sand/70">
        Categories are auto-selected from your store. Configure them in the Categories settings.
      </p>
    </div>
  );
}

function SolutionsByConcernConfig({ sectionData, onChange }: Omit<SectionConfigPanelProps, 'sectionKey'>) {
  return (
    <div className="space-y-3">
      <FieldRow label="Desktop Image">
        <DeferredMediaUploader
          value={(sectionData.desktopImageUrl as string) ?? ''}
          onChange={(url) => onChange({ desktopImageUrl: url })}
          uploadKey="solutionsByConcern_desktop"
          accept="image/*"
          maxSizeMB={10}
          label="Upload Desktop Image"
          placeholder="Upload desktop banner image"
          previewHeight="h-24"
          currentRealUrl={(sectionData.desktopImageUrl as string) ?? ''}
        />
      </FieldRow>
      <FieldRow label="Mobile Image (optional)">
        <DeferredMediaUploader
          value={(sectionData.mobileImageUrl as string) ?? ''}
          onChange={(url) => onChange({ mobileImageUrl: url })}
          uploadKey="solutionsByConcern_mobile"
          accept="image/*"
          maxSizeMB={5}
          label="Upload Mobile Image"
          placeholder="Leave empty to use desktop image"
          previewHeight="h-20"
          currentRealUrl={(sectionData.mobileImageUrl as string) ?? ''}
        />
      </FieldRow>
      <FieldRow label="Link URL (optional)">
        <Input
          value={(sectionData.link as string) ?? ''}
          onChange={(e) => onChange({ link: e.target.value })}
          placeholder="/solutions"
          className="h-8 text-xs"
        />
      </FieldRow>
    </div>
  );
}

function ShopByConcernConfig({ sectionData, onChange }: Omit<SectionConfigPanelProps, 'sectionKey'>) {
  return (
    <div className="space-y-3">
      <FieldRow label="Section Title">
        <Input
          value={(sectionData.title as string) ?? ''}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="e.g. Shop by Concern"
          className="h-8 text-xs"
        />
      </FieldRow>
      <p className="text-[11px] text-sand/70">
        Shop-by-concern items are managed in the dedicated tab. Use the title field above for the section heading.
      </p>
    </div>
  );
}

function GiftBoxConfig({ sectionData, onChange }: Omit<SectionConfigPanelProps, 'sectionKey'>) {
  return (
    <div className="space-y-3">
      <FieldRow label="Left Image">
        <DeferredMediaUploader
          value={(sectionData.leftImageUrl as string) ?? ''}
          onChange={(url) => onChange({ leftImageUrl: url })}
          uploadKey="giftBox_left"
          accept="image/*"
          maxSizeMB={10}
          label="Upload Left Image"
          placeholder="Upload left half image"
          previewHeight="h-24"
          currentRealUrl={(sectionData.leftImageUrl as string) ?? ''}
        />
      </FieldRow>
      <FieldRow label="Right Image">
        <DeferredMediaUploader
          value={(sectionData.rightImageUrl as string) ?? ''}
          onChange={(url) => onChange({ rightImageUrl: url })}
          uploadKey="giftBox_right"
          accept="image/*"
          maxSizeMB={10}
          label="Upload Right Image"
          placeholder="Upload right half image"
          previewHeight="h-24"
          currentRealUrl={(sectionData.rightImageUrl as string) ?? ''}
        />
      </FieldRow>
      <FieldRow label="Title (optional)">
        <Input
          value={(sectionData.title as string) ?? ''}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="e.g. Gift Box Collection"
          className="h-8 text-xs"
        />
      </FieldRow>
      <FieldRow label="Subtitle (optional)">
        <Input
          value={(sectionData.subtitle as string) ?? ''}
          onChange={(e) => onChange({ subtitle: e.target.value })}
          placeholder="e.g. Curated wellness sets"
          className="h-8 text-xs"
        />
      </FieldRow>
      <FieldRow label="Link URL (optional)">
        <Input
          value={(sectionData.link as string) ?? ''}
          onChange={(e) => onChange({ link: e.target.value })}
          placeholder="/collections/gift-boxes"
          className="h-8 text-xs"
        />
      </FieldRow>
    </div>
  );
}

function LatestProductsConfig({ sectionData, onChange }: Omit<SectionConfigPanelProps, 'sectionKey'>) {
  return (
    <div className="space-y-3">
      <FieldRow label="Section Title">
        <Input
          value={(sectionData.title as string) ?? ''}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="e.g. New Arrivals"
          className="h-8 text-xs"
        />
      </FieldRow>
      <FieldRow label="Number of Products">
        <Input
          type="number"
          min={1}
          max={50}
          value={((sectionData.productCount as number) ?? 10).toString()}
          onChange={(e) => onChange({ productCount: parseInt(e.target.value, 10) || 10 })}
          className="h-8 text-xs w-24"
        />
      </FieldRow>
    </div>
  );
}

function PromoBannerConfig({ sectionData, onChange }: Omit<SectionConfigPanelProps, 'sectionKey'>) {
  return (
    <div className="space-y-3">
      <FieldRow label="Desktop Image">
        <DeferredMediaUploader
          value={(sectionData.desktopImageUrl as string) ?? ''}
          onChange={(url) => onChange({ desktopImageUrl: url })}
          uploadKey="promoBanner_desktop"
          accept="image/*"
          maxSizeMB={10}
          label="Upload Desktop Banner"
          placeholder="Upload full-width desktop banner"
          previewHeight="h-24"
          currentRealUrl={(sectionData.desktopImageUrl as string) ?? ''}
        />
      </FieldRow>
      <FieldRow label="Mobile Image (optional)">
        <DeferredMediaUploader
          value={(sectionData.mobileImageUrl as string) ?? ''}
          onChange={(url) => onChange({ mobileImageUrl: url })}
          uploadKey="promoBanner_mobile"
          accept="image/*"
          maxSizeMB={5}
          label="Upload Mobile Banner"
          placeholder="Leave empty to use desktop banner"
          previewHeight="h-20"
          currentRealUrl={(sectionData.mobileImageUrl as string) ?? ''}
        />
      </FieldRow>
      <FieldRow label="Link URL (optional)">
        <Input
          value={(sectionData.link as string) ?? ''}
          onChange={(e) => onChange({ link: e.target.value })}
          placeholder="/promotions/sale"
          className="h-8 text-xs"
        />
      </FieldRow>
    </div>
  );
}

function BestSellingConfig({ sectionData, onChange }: Omit<SectionConfigPanelProps, 'sectionKey'>) {
  return (
    <div className="space-y-3">
      <FieldRow label="Section Title">
        <Input
          value={(sectionData.title as string) ?? ''}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="e.g. Best Sellers"
          className="h-8 text-xs"
        />
      </FieldRow>
      <FieldRow label="Number of Products">
        <Input
          type="number"
          min={1}
          max={50}
          value={((sectionData.productCount as number) ?? 10).toString()}
          onChange={(e) => onChange({ productCount: parseInt(e.target.value, 10) || 10 })}
          className="h-8 text-xs w-24"
        />
      </FieldRow>
    </div>
  );
}

function StoresBannerConfig({ sectionData, onChange }: Omit<SectionConfigPanelProps, 'sectionKey'>) {
  return (
    <div className="space-y-3">
      <FieldRow label="Desktop Image">
        <DeferredMediaUploader
          value={(sectionData.desktopImageUrl as string) ?? ''}
          onChange={(url) => onChange({ desktopImageUrl: url })}
          uploadKey="storesBanner_desktop"
          accept="image/*"
          maxSizeMB={10}
          label="Upload Desktop Banner"
          placeholder="Upload stores banner (1400x800 recommended)"
          previewHeight="h-24"
          currentRealUrl={(sectionData.desktopImageUrl as string) ?? ''}
        />
      </FieldRow>
      <FieldRow label="Mobile Image (optional)">
        <DeferredMediaUploader
          value={(sectionData.mobileImageUrl as string) ?? ''}
          onChange={(url) => onChange({ mobileImageUrl: url })}
          uploadKey="storesBanner_mobile"
          accept="image/*"
          maxSizeMB={5}
          label="Upload Mobile Banner"
          placeholder="Leave empty to use desktop banner"
          previewHeight="h-20"
          currentRealUrl={(sectionData.mobileImageUrl as string) ?? ''}
        />
      </FieldRow>
      <FieldRow label="Link URL (optional)">
        <Input
          value={(sectionData.link as string) ?? ''}
          onChange={(e) => onChange({ link: e.target.value })}
          placeholder="/stores"
          className="h-8 text-xs"
        />
      </FieldRow>
    </div>
  );
}

function HeroConfig({ sectionData, onChange }: Omit<SectionConfigPanelProps, 'sectionKey'>) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-sand/70">
        Hero media (image/video) and text overlays are configured in the <strong>Hero Banner</strong> tab.
      </p>
    </div>
  );
}

function TestimonialsConfig({ sectionData, onChange }: Omit<SectionConfigPanelProps, 'sectionKey'>) {
  return (
    <div className="space-y-3">
      <FieldRow label="Section Title">
        <Input
          value={(sectionData.title as string) ?? ''}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="e.g. What Our Customers Say"
          className="h-8 text-xs"
        />
      </FieldRow>
      <FieldRow label="Subtitle (optional)">
        <Input
          value={(sectionData.subtitle as string) ?? ''}
          onChange={(e) => onChange({ subtitle: e.target.value })}
          placeholder="e.g. Trusted by thousands"
          className="h-8 text-xs"
        />
      </FieldRow>
      <p className="text-[11px] text-sand/70">
        Individual testimonials are managed in the <strong>Testimonials</strong> tab.
      </p>
    </div>
  );
}

function FooterConfig({ sectionData, onChange }: Omit<SectionConfigPanelProps, 'sectionKey'>) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-sand/70">
        Footer content (columns, links, about text) is configured in the <strong>Footer</strong> tab.
      </p>
    </div>
  );
}

// ── Panel registry ───────────────────────────────────────────────────────────

const CONFIG_PANELS: Partial<Record<SectionKey, React.ComponentType<Omit<SectionConfigPanelProps, 'sectionKey'>>>> = {
  hero: HeroConfig,
  categories: CategoriesConfig,
  solutionsByConcern: SolutionsByConcernConfig,
  shopByConcern: ShopByConcernConfig,
  giftBox: GiftBoxConfig,
  latestProducts: LatestProductsConfig,
  promoBanner: PromoBannerConfig,
  bestSelling: BestSellingConfig,
  testimonials: TestimonialsConfig,
  storesBanner: StoresBannerConfig,
  footer: FooterConfig,
};

// ── Public component ─────────────────────────────────────────────────────────

export function SectionConfigPanel({ sectionKey, sectionData, onChange }: SectionConfigPanelProps) {
  const Panel = CONFIG_PANELS[sectionKey];
  if (!Panel) return null;

  return (
    <div className="px-4 pb-4 pt-2 border-t border-mist/30">
      <Panel sectionData={sectionData} onChange={onChange} />
    </div>
  );
}
