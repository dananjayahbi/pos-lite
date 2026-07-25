'use client';

import React, { useState, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { GeneralTab } from './website-tabs/GeneralTab';
import { NavigationTab } from './website-tabs/NavigationTab';
import { HeroSlidesTab } from './website-tabs/HeroSlidesTab';
import { SectionsTab } from './website-tabs/SectionsTab';
import { TestimonialsTab } from './website-tabs/TestimonialsTab';
import { FooterTab } from './website-tabs/FooterTab';
import { AdsTab } from './website-tabs/AdsTab';
import { AboutContactTab } from './website-tabs/AboutContactTab';
import { ShopTab } from './website-tabs/ShopTab';
import { ResetConfirmDialog } from './ResetConfirmDialog';
import type { WebsiteConfigData } from '@/types/website.types';

interface WebsiteSettingsFormProps {
  tenantId: string;
  initialConfig: WebsiteConfigData | null;
}

const DEFAULT_CONFIG: WebsiteConfigData = {
  siteName: '',
  tagline: '',
  logoUrl: '',
  faviconUrl: '',
  primaryColor: '#0a0a0a',
  accentColor: '#b4946e',
  bgColor: '#ece2d6',
  metaTitle: '',
  metaDescription: '',
  socialLinks: {},
  navItems: [],
  sections: {
    hero: { isActive: true, sortOrder: 1 },
    categories: { isActive: true, sortOrder: 2 },
    solutionsByConcern: { isActive: true, sortOrder: 3 },
    shopByConcern: { isActive: true, sortOrder: 4 },
    giftBox: { isActive: true, sortOrder: 5 },
    latestProducts: { isActive: true, sortOrder: 6 },
    promoBanner: { isActive: true, sortOrder: 7 },
    bestSelling: { isActive: true, sortOrder: 8 },
    testimonials: { isActive: true, sortOrder: 9 },
    storesBanner: { isActive: true, sortOrder: 10 },
    footer: { isActive: true, sortOrder: 11 },
  },
  footerAbout: '',
  footerColumns: [],
  heroSlides: [],
  ads: [],
};

const TABS = [
  { value: 'general', label: 'General' },
  { value: 'navigation', label: 'Navigation' },
  { value: 'hero', label: 'Hero Slides' },
  { value: 'sections', label: 'Sections' },
  { value: 'testimonials', label: 'Testimonials' },
  { value: 'footer', label: 'Footer' },
  { value: 'ads', label: 'Ads' },
  { value: 'about-contact', label: 'About & Contact' },
  { value: 'shop', label: 'Shop' },
];

export function WebsiteSettingsForm({
  tenantId,
  initialConfig,
}: WebsiteSettingsFormProps) {
  const [config, setConfig] = useState<WebsiteConfigData>(
    initialConfig ?? DEFAULT_CONFIG
  );
  const [saving, setSaving] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);

  const updateConfig = useCallback((updates: Partial<WebsiteConfigData>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  // ── Sanitize null values from the DB before sending to the API ────────────

  function sanitizeCoreConfig(data: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === null) {
        result[key] = '';
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result[key] = sanitizeCoreConfig(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Save core website config (without heroSlides/ads — those are separate)
      const { heroSlides, ads, ...coreConfig } = config;
      // Sanitize: convert null → '' for string fields so zod validation passes
      const sanitized = sanitizeCoreConfig(coreConfig);
      const res = await fetch('/api/store/website', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitized),
      });

      const data = await res.json();

      if (!data.success) {
        const details = data.error?.details;
        const fieldErrors = details?.fieldErrors;
        if (fieldErrors && Object.keys(fieldErrors).length > 0) {
          const firstError = Object.entries(fieldErrors)
            .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(', ')}`)
            .join('; ');
          toast.error(`Validation error: ${firstError}`);
        } else {
          toast.error(data.error?.message || 'Failed to save');
        }
        return;
      }

      // 2. Sync hero slides through dedicated endpoints
      if (heroSlides && heroSlides.length > 0) {
        await syncHeroSlides(heroSlides);
      }

      // 3. Sync ads through dedicated endpoints
      if (ads && ads.length > 0) {
        await syncAds(ads);
      }

      toast.success('Website configuration saved successfully');

      // Refetch latest config from server so state stays in sync
      // (critical for multi-tab scenarios — Tab B sees Tab A's changes)
      try {
        const res = await fetch('/api/store/website');
        const body = await res.json();
        if (body.success && body.data) {
          const fresh: WebsiteConfigData = JSON.parse(JSON.stringify(body.data));
          setConfig(fresh);
        }
      } catch {
        // If refetch fails, local state is still valid
      }
    } catch {
      toast.error('An error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  // ── Inline sync helpers ──────────────────────────────────────────────────

  async function syncHeroSlides(slides: WebsiteConfigData['heroSlides']) {
    if (!slides) return;
    for (const slide of slides) {
      try {
        const sanitized = sanitizeCoreConfig(slide as unknown as Record<string, unknown>) as unknown as typeof slide;
        if (slide.id) {
          // Update existing
          await fetch(`/api/store/website/hero-slides/${slide.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sanitized),
          });
        } else {
          // Create new
          await fetch('/api/store/website/hero-slides', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sanitized),
          });
        }
      } catch (err) {
        console.error('Failed to sync hero slide:', err);
      }
    }
  }

  async function syncAds(adsList: WebsiteConfigData['ads']) {
    if (!adsList) return;
    for (const ad of adsList) {
      try {
        const sanitized = sanitizeCoreConfig(ad as unknown as Record<string, unknown>) as unknown as typeof ad;
        if (ad.id) {
          await fetch(`/api/store/website/ads/${ad.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sanitized),
          });
        } else {
          await fetch('/api/store/website/ads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sanitized),
          });
        }
      } catch (err) {
        console.error('Failed to sync ad:', err);
      }
    }
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="general" className="w-full">
        <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <TabsList className="w-full min-w-max justify-start border-b border-mist rounded-none bg-transparent h-auto p-0">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="whitespace-nowrap data-[state=active]:border-b-2 data-[state=active]:border-terracotta data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none px-4 py-2 text-sm text-sand data-[state=active]:text-espresso"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="mt-6 min-h-[400px]">
          <TabsContent value="general">
            <GeneralTab config={config} onChange={updateConfig} />
          </TabsContent>

          <TabsContent value="navigation">
            <NavigationTab config={config} onChange={updateConfig} />
          </TabsContent>

          <TabsContent value="hero">
            <HeroSlidesTab
              tenantId={tenantId}
              config={config}
              onChange={updateConfig}
            />
          </TabsContent>

          <TabsContent value="sections">
            <SectionsTab config={config} onChange={updateConfig} />
          </TabsContent>

          <TabsContent value="testimonials">
            <TestimonialsTab config={config} onChange={updateConfig} />
          </TabsContent>

          <TabsContent value="footer">
            <FooterTab config={config} onChange={updateConfig} />
          </TabsContent>

          <TabsContent value="ads">
            <AdsTab
              tenantId={tenantId}
              config={config}
              onChange={updateConfig}
            />
          </TabsContent>

          <TabsContent value="about-contact">
            <AboutContactTab config={config} onChange={updateConfig} />
          </TabsContent>

          <TabsContent value="shop">
            <ShopTab config={config} onChange={updateConfig} />
          </TabsContent>
        </div>
      </Tabs>

      {/* Save bar */}
      <div className="sticky bottom-0 bg-pearl border-t border-mist p-4 flex justify-end gap-3 rounded-b-lg">
        <Button
          variant="outline"
          onClick={() => setShowResetDialog(true)}
          disabled={saving}
        >
          Reset
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-espresso hover:bg-espresso/90"
        >
          {saving ? 'Saving...' : 'Save All Changes'}
        </Button>
      </div>

      <ResetConfirmDialog
        open={showResetDialog}
        onOpenChange={setShowResetDialog}
        onConfirm={() => setConfig(initialConfig ?? DEFAULT_CONFIG)}
        disabled={saving}
      />
    </div>
  );
}
