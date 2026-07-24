'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { MediaUploader } from '@/components/shared/MediaUploader';
import type { WebsiteConfigData } from '@/types/website.types';

interface ShopTabProps {
  config: WebsiteConfigData;
  onChange: (updates: Partial<WebsiteConfigData>) => void;
}

export function ShopTab({ config, onChange }: ShopTabProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-espresso mb-1">Shop Page</h3>
        <p className="text-xs text-sand mb-4">
          Configure the content shown on the /shop page of your storefront.
        </p>

        <div className="space-y-4">
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
                placeholder="Browse our collection..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Hero Image</Label>
            <MediaUploader
              value={config.shopHeroImageUrl ?? ''}
              onChange={(url) => onChange({ shopHeroImageUrl: url })}
              accept="image/*"
              maxSizeMB={5}
              label="Upload Hero Image"
              placeholder="Optional banner image for the shop page"
              previewHeight="h-20"
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="shopPageDescription">Page Description</Label>
            <Textarea
              id="shopPageDescription"
              value={config.shopPageDescription ?? ''}
              onChange={(e) => onChange({ shopPageDescription: e.target.value })}
              placeholder="Browse our complete collection of premium products..."
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
      </div>
    </div>
  );
}
