'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { DeferredMediaUploader } from '@/components/shared/DeferredMediaUploader';
import type { WebsiteConfigData } from '@/types/website.types';

interface ShopTabProps {
  config: WebsiteConfigData;
  onChange: (updates: Partial<WebsiteConfigData>) => void;
}

export function ShopTab({ config, onChange }: ShopTabProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-cream/40 bg-cream/20 px-3 py-2">
        <h3 className="text-sm font-semibold text-espresso">Shop Page</h3>
        <p className="mt-0.5 text-xs text-sand">
          Reference layout: a glassmorphic filter chamber (keyword search, price
          slider, sort) with category pills, above a responsive product mesh grid.
        </p>
      </div>

      {/* Page hero */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="shopPageTitle">Page Title</Label>
          <Input
            id="shopPageTitle"
            value={config.shopPageTitle ?? ''}
            onChange={(e) => onChange({ shopPageTitle: e.target.value })}
            placeholder="Shop"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="shopPageSubtitle">Page Subtitle</Label>
          <Input
            id="shopPageSubtitle"
            value={config.shopPageSubtitle ?? ''}
            onChange={(e) => onChange({ shopPageSubtitle: e.target.value })}
            placeholder="Browse our collection"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Hero Image</Label>
        <DeferredMediaUploader
          value={config.shopHeroImageUrl ?? ''}
          onChange={(url: string) => onChange({ shopHeroImageUrl: url })}
          uploadKey="shop_hero"
          accept="image/*"
          maxSizeMB={5}
          label="Upload Hero Image"
          placeholder="Optional banner image for the shop page"
          previewHeight="h-20"
          currentRealUrl={config.shopHeroImageUrl ?? ''}
        />
      </div>

      <Separator />

      <div className="space-y-2">
        <Label htmlFor="shopPageDescription">Page Description</Label>
        <Textarea
          id="shopPageDescription"
          value={config.shopPageDescription ?? ''}
          onChange={(e) => onChange({ shopPageDescription: e.target.value })}
          placeholder="Discover our pure Ayurvedic elixirs, oils, and balms crafted with ancestral herbs and slow-decoction wisdom."
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="shopProductsPerPage">Products Per Page</Label>
        <Input
          id="shopProductsPerPage"
          type="number"
          min={1}
          max={100}
          value={config.shopProductsPerPage ?? 24}
          onChange={(e) =>
            onChange({ shopProductsPerPage: Number.parseInt(e.target.value, 10) || 24 })
          }
          placeholder="24"
        />
        <p className="text-xs text-sand">
          Number of products to display per page (default: 24).
        </p>
      </div>
    </div>
  );
}
