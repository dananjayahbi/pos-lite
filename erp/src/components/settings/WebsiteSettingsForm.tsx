'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Menu,
  Image,
  Layers,
  MessageSquareQuote,
  Footprints,
  Megaphone,
  FileText,
  Store,
  Palette,
} from 'lucide-react';
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
import { pendingUploads, removedUrls, processPendingUploads, deleteRemovedUrls, resetUploadState } from './uploadState';
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
  { value: 'general', label: 'General', icon: Palette },
  { value: 'navigation', label: 'Navigation', icon: Menu },
  { value: 'hero', label: 'Hero Banner', icon: Image },
  { value: 'sections', label: 'Sections', icon: Layers },
  { value: 'testimonials', label: 'Testimonials', icon: MessageSquareQuote },
  { value: 'footer', label: 'Footer', icon: Footprints },
  { value: 'ads', label: 'Ads', icon: Megaphone },
  { value: 'about-contact', label: 'About & Contact', icon: FileText },
  { value: 'shop', label: 'Shop', icon: Store },
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

  /** Replace ObjectURLs in the config with real Cloudflare URLs after upload. */
  function resolvePendingUrls(
    cfg: WebsiteConfigData,
    uploaded: Map<string, string>,
  ): WebsiteConfigData {
    if (uploaded.size === 0) return cfg;

    const serialized = JSON.stringify(cfg);
    let resolved = serialized;

    for (const [key, { objectUrl }] of pendingUploads.entries()) {
      const realUrl = uploaded.get(key);
      if (realUrl && objectUrl) {
        // Replace the ObjectURL with the real Cloudflare URL
        resolved = resolved.split(objectUrl).join(realUrl);
      }
    }

    return JSON.parse(resolved) as WebsiteConfigData;
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      // 0. Process deferred media uploads (upload pending files to Cloudflare)
      let uploadedUrls: Map<string, string> = new Map();
      if (pendingUploads.size > 0) {
        try {
          uploadedUrls = await processPendingUploads();
        } catch (uploadErr) {
          toast.error('Failed to upload media files. Please try again.');
          console.error('Upload error:', uploadErr);
          setSaving(false);
          return;
        }
      }

      // Replace ObjectURLs with real Cloudflare URLs in the config
      const resolvedConfig = resolvePendingUrls(config, uploadedUrls);

      // 1. Save core website config (without heroSlides/ads — those are separate)
      const { heroSlides, ads, ...coreConfig } = resolvedConfig;
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

      // 4. Delete removed media from Cloudflare
      if (removedUrls.size > 0) {
        try {
          await deleteRemovedUrls();
        } catch (delErr) {
          console.warn('Failed to delete some media files:', delErr);
        }
      }

      // 5. Clear upload state
      resetUploadState();

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

  const [activeTab, setActiveTab] = useState('general');

  // ── Tab content map ─────────────────────────────────────────────────────

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return <GeneralTab config={config} onChange={updateConfig} />;
      case 'navigation':
        return <NavigationTab config={config} onChange={updateConfig} />;
      case 'hero':
        return <HeroSlidesTab tenantId={tenantId} config={config} onChange={updateConfig} />;
      case 'sections':
        return <SectionsTab config={config} onChange={updateConfig} />;
      case 'testimonials':
        return <TestimonialsTab config={config} onChange={updateConfig} />;
      case 'footer':
        return <FooterTab config={config} onChange={updateConfig} />;
      case 'ads':
        return <AdsTab tenantId={tenantId} config={config} onChange={updateConfig} />;
      case 'about-contact':
        return <AboutContactTab config={config} onChange={updateConfig} />;
      case 'shop':
        return <ShopTab config={config} onChange={updateConfig} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex gap-0 min-h-[600px] border border-mist rounded-xl bg-white overflow-hidden">
      {/* ── Vertical Sidebar Navigation ─────────────────────────────────── */}
      <nav className="w-56 shrink-0 border-r border-mist bg-cream/20 flex flex-col">
        <div className="p-4 border-b border-mist/50">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-sand">
            Settings
          </p>
        </div>
        <div className="flex-1 py-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all duration-150 text-left ${
                  isActive
                    ? 'bg-white text-espresso font-medium border-r-2 border-terracotta shadow-sm'
                    : 'text-sand hover:text-espresso hover:bg-white/60'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-terracotta' : 'text-sand/60'}`} />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Main Content Area ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
          {renderTabContent()}
        </div>

        {/* Save bar */}
        <div className="sticky bottom-0 bg-white border-t border-mist px-6 py-4 flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => setShowResetDialog(true)}
            disabled={saving}
            size="sm"
          >
            Reset to Defaults
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-espresso hover:bg-espresso/90"
            size="sm"
          >
            {saving ? 'Saving...' : 'Save All Changes'}
          </Button>
        </div>
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
