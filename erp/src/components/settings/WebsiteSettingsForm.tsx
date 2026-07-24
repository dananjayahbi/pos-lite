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
];

export function WebsiteSettingsForm({
  tenantId,
  initialConfig,
}: WebsiteSettingsFormProps) {
  const [config, setConfig] = useState<WebsiteConfigData>(
    initialConfig ?? DEFAULT_CONFIG
  );
  const [saving, setSaving] = useState(false);

  const updateConfig = useCallback((updates: Partial<WebsiteConfigData>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/store/website', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      const data = await res.json();

      if (!data.success) {
        toast.error(data.error?.message || 'Failed to save');
        return;
      }

      toast.success('Website configuration saved successfully');
    } catch {
      toast.error('An error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto border-b border-mist rounded-none bg-transparent h-auto p-0">
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="data-[state=active]:border-b-2 data-[state=active]:border-terracotta data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none px-4 py-2 text-sm text-sand data-[state=active]:text-espresso"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

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
        </div>
      </Tabs>

      {/* Save bar */}
      <div className="sticky bottom-0 bg-pearl border-t border-mist p-4 flex justify-end gap-3 rounded-b-lg">
        <Button
          variant="outline"
          onClick={() => setConfig(initialConfig ?? DEFAULT_CONFIG)}
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
    </div>
  );
}
