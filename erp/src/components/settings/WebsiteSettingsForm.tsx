'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Palette, Layout, Layers, Footprints, ShoppingBag, FileText, Phone, AlertTriangle, CalendarDays } from 'lucide-react';
import { GeneralTab } from './website-tabs/GeneralTab';
import { HeaderTab } from './website-tabs/HeaderTab';
import { LandingPageTab } from './website-tabs/LandingPageTab';
import { FooterTab } from './website-tabs/FooterTab';
import { AboutPageTab } from './website-tabs/AboutPageTab';
import { ContactPageTab } from './website-tabs/ContactPageTab';
import { ShopTab } from './website-tabs/ShopTab';
import { AppointmentsTab } from './website-tabs/AppointmentsTab';
import { ResetConfirmDialog } from './ResetConfirmDialog';
import { pendingUploads, removedUrls, processPendingUploads, deleteRemovedUrls, resetUploadState } from './uploadState';
import type { WebsiteConfigData } from '@/types/website.types';
import { resolveWebsiteLoadResult } from '@/lib/website/load-state';

const DEFAULT_CONFIG: WebsiteConfigData = {
  siteName: '',
  tagline: '',
  logoUrl: '',
  faviconUrl: '',
  primaryColor: '#0a0a0a',
  accentColor: '#b4946e',
  bgColor: '#ece2d6',
  headingFontFamily: '',
  bodyFontFamily: '',
  headingColor: '#0a0a0a',
  bodyColor: '#555555',
  metaTitle: '',
  metaDescription: '',
  socialLinks: {},
  announcementBar: { text: '', link: '', isActive: false },
  navItems: [],
  sections: {
    hero: { isActive: true, sortOrder: 1 },
    imageSlider: { isActive: true, sortOrder: 2, images: [] },
    bestSelling: { isActive: true, sortOrder: 3, label: 'MOST LOVED PRODUCTS', title: 'Top Selling Items This Week', productCount: 7, productIds: [] },
    infoAd: { isActive: true, sortOrder: 4, desktopImageUrl: '', title: '', subtitle: '' },
    categories: { isActive: true, sortOrder: 5, label: 'SHOP BY CATEGORY', title: 'Top Categories', categoryIds: [], categoryImages: {} },
    latestProducts: { isActive: true, sortOrder: 6, label: 'NEW ARRIVALS', title: 'Latest Products', productCount: 7, productIds: [] },
    testimonials: { isActive: true, sortOrder: 7, label: 'VOICES OF HEALING', title: 'Testimonials', subtitle: 'What Our Community Says', items: [] },
    storeReference: { isActive: true, sortOrder: 8, desktopImageUrl: '', title: '', subtitle: '' },
    footer: { isActive: true, sortOrder: 9 },
  },
  footerAbout: '',
  footerColumns: [],
  heroSlides: [],
  aboutPageTitle: 'About Us',
  aboutPageSubtitle: '',
  aboutStoryTitle: 'Our Story',
  aboutStoryContent: '',
  aboutMissionTitle: 'Our Mission',
  aboutMissionContent: '',
  aboutValuesSectionTitle: 'Our Values',
  aboutValues: [],
  aboutPhoneLabel: '',
  aboutPhoneNumber: '',
  contactPageTitle: 'Contact Us',
  contactPageSubtitle: '',
  contactInfoTitle: 'Get in Touch',
  contactAddress: '',
  contactPhoneDisplay: '',
  contactEmailDisplay: '',
  contactBusinessHours: '',
  shopPageTitle: 'Shop',
  shopPageSubtitle: '',
  shopPageDescription: '',
  shopProductsPerPage: 24,
  appointments: {
    enabled: false,
    navLabel: 'Appointments',
    title: 'Book an Appointment',
    subtitle: '',
    serviceIds: [],
    intro: '',
  },
};

const TABS = [
  { value: 'general', label: 'General', icon: Palette },
  { value: 'header', label: 'Header', icon: Layout },
  { value: 'landing', label: 'Landing Page', icon: Layers },
  { value: 'footer', label: 'Footer', icon: Footprints },
  { value: 'shop', label: 'Shop Page', icon: ShoppingBag },
  { value: 'about', label: 'About Page', icon: FileText },
  { value: 'contact', label: 'Contact Page', icon: Phone },
  { value: 'appointments', label: 'Appointments', icon: CalendarDays },
] as const;

type TabValue = (typeof TABS)[number]['value'];

/**
 * Recursively merge a loaded config over the defaults so nested JSON
 * structures (sections, social links, footer columns, about values) are
 * filled from defaults when the stored value is empty/missing, while
 * preserving any saved values. Arrays (e.g. heroSlides) are taken from the
 * loaded value as-is.
 */
function deepMergeConfig(
  base: Record<string, unknown>,
  overlay: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    if (value === null || value === undefined) continue;
    const current = result[key];
    if (isPlainObject(current) && isPlainObject(value)) {
      result[key] = deepMergeConfig(current, value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export default function WebsiteSettingsForm({ tenantSlug = '' }: { tenantSlug?: string }) {
  const [config, setConfig] = useState<WebsiteConfigData>(DEFAULT_CONFIG);
  const [activeTab, setActiveTab] = useState<TabValue>('general');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const [startedFromEmpty, setStartedFromEmpty] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  // Cheap O(1) dirty tracking — avoids expensive JSON.stringify on every keystroke
  const [dirtyCount, setDirtyCount] = useState(0);

  const initialConfigRef = useRef<string>('');
  const pendingTabRef = useRef<TabValue | null>(null);

  const isDirty = dirtyCount > 0;

  // Beforeunload listener — read from reliable state, stable closure
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyCount > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirtyCount]);

  // Load config from API on mount (and on retry)
  useEffect(() => {
    let cancelled = false;

    const loadConfig = async () => {
      setLoadState('loading');
      setLoadError('');
      try {
        const res = await fetch('/api/store/website', { cache: 'no-store' });
        const body = await res.json().catch(() => null);
        if (cancelled) return;

        const result = resolveWebsiteLoadResult({ ok: res.ok, status: res.status, body });
        if (result.kind === 'ready') {
          const merged = deepMergeConfig(
            DEFAULT_CONFIG as unknown as Record<string, unknown>,
            result.data,
          ) as unknown as WebsiteConfigData;
          setConfig(merged);
          initialConfigRef.current = JSON.stringify(merged);
          setLoadState('ready');
        } else if (result.kind === 'empty') {
          setConfig(DEFAULT_CONFIG);
          initialConfigRef.current = JSON.stringify(DEFAULT_CONFIG);
          setStartedFromEmpty(false);
          setDirtyCount(0);
          setLoadState('empty');
        } else {
          setLoadError(result.message);
          setLoadState('error');
        }
      } catch {
        if (cancelled) return;
        setLoadError('Failed to load the website configuration. Check your connection and retry.');
        setLoadState('error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    loadConfig();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  // Pure state updater — increments dirty counter on every change
  const updateConfig = useCallback((updates: Partial<WebsiteConfigData>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
    setDirtyCount((c) => c + 1);
  }, []);

  const handleTabChange = (tab: TabValue) => {
    if (tab === activeTab) return;
    if (isDirty) {
      pendingTabRef.current = tab;
      setShowUnsavedDialog(true);
    } else {
      setActiveTab(tab);
    }
  };

  const handleDiscard = () => {
    const initial = JSON.parse(initialConfigRef.current) as WebsiteConfigData;
    setConfig(initial);
    setDirtyCount(0);
    setShowUnsavedDialog(false);
    resetUploadState();
    if (pendingTabRef.current) {
      setActiveTab(pendingTabRef.current);
      pendingTabRef.current = null;
    }
  };

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
        resolved = resolved.split(objectUrl).join(realUrl);
      }
    }

    return JSON.parse(resolved) as WebsiteConfigData;
  }

  const handleSave = async () => {
    if (loadState !== 'ready' && !(loadState === 'empty' && startedFromEmpty)) {
      toast.error('Website configuration is not loaded - reload before saving');
      return;
    }
    if (!config.siteName?.trim()) {
      toast.error('Set a Site Name on the General tab before saving');
      return;
    }
    setIsSaving(true);
    try {
      // Process deferred media uploads (upload pending files to Cloudflare)
      let uploadedUrls: Map<string, string> = new Map();
      if (pendingUploads.size > 0) {
        try {
          uploadedUrls = await processPendingUploads();
        } catch {
          toast.error('Failed to upload media files. Please try again.');
          setIsSaving(false);
          return;
        }
      }

      // Replace ObjectURLs with real Cloudflare URLs in the config
      const resolvedConfig = resolvePendingUrls(config, uploadedUrls);

      // Save entire config (heroSlides are now embedded in the config)
      const sanitized = sanitizeCoreConfig(resolvedConfig as unknown as Record<string, unknown>);
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

      // Delete removed media from Cloudflare
      if (removedUrls.size > 0) {
        try {
          await deleteRemovedUrls();
        } catch {
          console.warn('Failed to delete some media files');
        }
      }

      // Reset upload state
      resetUploadState();
      initialConfigRef.current = JSON.stringify(resolvedConfig);
      setConfig(resolvedConfig);
      setDirtyCount(0);

      toast.success('Website settings saved successfully');
    } catch {
      toast.error('An error occurred while saving');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAndLeave = async () => {
    await handleSave();
    setShowUnsavedDialog(false);
    if (pendingTabRef.current) {
      setActiveTab(pendingTabRef.current);
      pendingTabRef.current = null;
    }
  };

  const handleReset = async () => {
    try {
      const res = await fetch('/api/store/website', { method: 'DELETE' });
      const json = (await res.json().catch(() => null)) as
        | {
            success?: boolean;
            data?: {
              reset?: boolean;
              deletedAssets?: number;
              failedAssets?: number;
              skippedAssets?: number;
            };
          }
        | null;
      if (!res.ok || !json?.success) throw new Error('Failed to reset');

      const deletedAssets = json.data?.deletedAssets ?? 0;
      const failedAssets = json.data?.failedAssets ?? 0;

      setConfig(DEFAULT_CONFIG);
      setDirtyCount(0);
      initialConfigRef.current = JSON.stringify(DEFAULT_CONFIG);
      setStartedFromEmpty(false);
      setLoadState('empty');
      resetUploadState();
      setShowResetDialog(false);

      toast.success(
        deletedAssets > 0
          ? `Website reset to defaults - ${deletedAssets} uploaded file${deletedAssets === 1 ? '' : 's'} removed`
          : 'Website reset to defaults',
      );
      if (failedAssets > 0) {
        toast.error(
          `${failedAssets} uploaded file${failedAssets === 1 ? '' : 's'} could not be removed from storage`,
        );
      }
    } catch {
      toast.error('Failed to reset configuration');
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return <GeneralTab config={config} onChange={updateConfig} />;
      case 'header':
        return <HeaderTab config={config} onChange={updateConfig} />;
      case 'landing':
        return <LandingPageTab config={config} onChange={updateConfig} />;
      case 'footer':
        return <FooterTab config={config} onChange={updateConfig} />;
      case 'shop':
        return <ShopTab config={config} onChange={updateConfig} />;
      case 'about':
        return <AboutPageTab config={config} onChange={updateConfig} />;
      case 'contact':
        return <ContactPageTab config={config} onChange={updateConfig} />;
      case 'appointments':
        return <AppointmentsTab config={config} onChange={updateConfig} tenantSlug={tenantSlug} />;
      default:
        return null;
    }
  };

  if (isLoading || loadState === 'loading') {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-espresso border-t-transparent" />
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="mx-auto max-w-xl space-y-4 p-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
          <AlertTriangle className="h-6 w-6 text-amber-600" />
        </div>
        <h2 className="text-lg font-semibold text-espresso">Website configuration could not be loaded</h2>
        <p className="text-sm text-sand-ink">
          {loadError || 'The request failed. Your live site has not been changed.'}
        </p>
        <Button
          type="button"
          className="bg-espresso hover:bg-espresso/90"
          onClick={() => {
            setIsLoading(true);
            setReloadToken((token) => token + 1);
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (loadState === 'empty' && !startedFromEmpty) {
    return (
      <div className="mx-auto max-w-xl space-y-4 p-10 text-center">
        <h2 className="text-lg font-semibold text-espresso">Website not configured</h2>
        <p className="text-sm text-sand-ink">
          This store does not have a website configuration yet. Starting here opens a blank
          template - nothing is published until you save.
        </p>
        <Button
          type="button"
          className="bg-espresso hover:bg-espresso/90"
          onClick={() => {
            setConfig(DEFAULT_CONFIG);
            initialConfigRef.current = JSON.stringify(DEFAULT_CONFIG);
            setDirtyCount(0);
            setStartedFromEmpty(true);
          }}
        >
          Create website configuration
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="bg-white">
        {/* ── Page header (inside card, full width) ──────────────────────────── */}
        <div className="px-6 py-3.5 border-b border-mist">
          <h1 className="text-2xl font-bold text-espresso">
            Website Configuration
          </h1>
        </div>

        <div className="flex gap-0 min-h-[600px]">
          {/* ── Vertical Sidebar Navigation ─────────────────────────────────── */}
          <nav className="w-56 shrink-0 border-r border-mist bg-cream/20 flex flex-col">
            <div className="p-4 border-b border-mist/50">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-sand-ink">
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
                    onClick={() => handleTabChange(tab.value)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all duration-150 text-left ${
                      isActive
                        ? 'bg-white text-espresso font-medium border-r-2 border-terracotta shadow-sm'
                        : 'text-sand-ink hover:text-espresso hover:bg-white/60'
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-terracotta' : 'text-sand-ink/60'}`} />
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
            <div className="sticky bottom-0 bg-white border-t border-mist px-6 py-4 flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="text-terracotta hover:text-terracotta/80"
                onClick={() => setShowResetDialog(true)}
                disabled={isSaving}
                type="button"
              >
                Delete all content
              </Button>

              <div className="flex items-center gap-3">
                {isDirty && (
                  <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>
                )}
                <Button
                  size="sm"
                  className="bg-espresso hover:bg-espresso/90"
                  onClick={handleSave}
                  disabled={isSaving || !isDirty}
                  type="button"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Unsaved changes dialog */}
        {showUnsavedDialog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <h3 className="text-lg font-semibold text-espresso">Unsaved Changes</h3>
              </div>
              <p className="text-sm text-sand-ink mb-6">
                You have unsaved changes. Do you want to save before leaving?
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" size="sm" onClick={() => setShowUnsavedDialog(false)}>
                  Cancel
                </Button>
                <Button variant="ghost" size="sm" className="text-terracotta" onClick={handleDiscard}>
                  Discard
                </Button>
                <Button size="sm" className="bg-espresso hover:bg-espresso/90" onClick={handleSaveAndLeave}>
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Reset confirmation dialog.
            NOTE: `handleReset` calls DELETE /api/store/website, which is a HARD
            RESET — it clears every config field (including colours, typography,
            announcement and appointments), deletes all hero slides/ads and
            removes uploaded website files where storage allows. The wording
            below must describe that, not a harmless "discard unsaved changes". */}
        <ResetConfirmDialog
          open={showResetDialog}
          onOpenChange={setShowResetDialog}
          onConfirm={handleReset}
          disabled={isSaving}
          title="Delete all website content"
          description={
            <>
              This permanently deletes <strong>all saved website content</strong> -
              branding, colours, typography, announcement bar, page copy, navigation,
              appointments settings, hero slides, ads and every uploaded website file.
              The storefront will fall back to built-in defaults.{' '}
              <strong>This cannot be undone.</strong>
            </>
          }
          confirmPhrase="delete everything"
          confirmLabel="Delete all content"
        />
      </div>
    </div>
  );
}
