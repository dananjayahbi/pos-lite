'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { MediaUploader } from '@/components/shared/MediaUploader';
import type { WebsiteConfigData, WebsiteAdData } from '@/types/website.types';

interface AdsTabProps {
  tenantId: string;
  config: WebsiteConfigData;
  onChange: (updates: Partial<WebsiteConfigData>) => void;
}

export function AdsTab({ config, onChange }: AdsTabProps) {
  const ads: WebsiteAdData[] = config.ads ?? [];

  const addAd = () => {
    onChange({
      ads: [
        ...ads,
        {
          name: 'New Advertisement',
          mediaType: 'image',
          mediaUrl: '',
          position: 'between_sections',
          isActive: true,
        },
      ],
    });
  };

  const updateAd = (index: number, updates: Partial<WebsiteAdData>) => {
    const updated = ads.map((ad, i) => (i === index ? { ...ad, ...updates } : ad));
    onChange({ ads: updated });
  };

  const removeAd = (index: number) => {
    onChange({ ads: ads.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-espresso">Advertisements</h3>
          <p className="text-xs text-sand mt-1">
            Add banners, videos, or promotional content between website sections.
            Ads respect start/end dates.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={addAd}>
          <Plus className="h-4 w-4 mr-1" /> Add Ad
        </Button>
      </div>

      <div className="space-y-4">
        {ads.map((ad, i) => (
          <div key={i} className="border border-mist rounded-lg p-4 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Ad: {ad.name || `#${i + 1}`}</span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Active</Label>
                  <Switch
                    checked={ad.isActive}
                    onCheckedChange={(checked) => updateAd(i, { isActive: checked })}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeAd(i)}
                  className="text-terracotta"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Ad Name</Label>
                <Input
                  value={ad.name}
                  onChange={(e) => updateAd(i, { name: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Media Type</Label>
                <Select
                  value={ad.mediaType}
                  onValueChange={(val) => updateAd(i, { mediaType: val as 'image' | 'video' })}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">Image</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs">Media</Label>
                <MediaUploader
                  value={ad.mediaUrl}
                  onChange={(url) => updateAd(i, { mediaUrl: url })}
                  accept={ad.mediaType === 'video' ? 'video/*' : 'image/*'}
                  maxSizeMB={ad.mediaType === 'video' ? 100 : 10}
                  label={ad.mediaType === 'video' ? 'Upload Video' : 'Upload Image'}
                  placeholder={
                    ad.mediaType === 'video'
                      ? 'Upload ad video (MP4/WebM)'
                      : 'Upload ad image (JPG/PNG/WebP)'
                  }
                  previewHeight="h-24"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Mobile Media (optional)</Label>
                <MediaUploader
                  value={ad.mobileMediaUrl ?? ''}
                  onChange={(url) => updateAd(i, { mobileMediaUrl: url })}
                  accept={ad.mediaType === 'video' ? 'video/*' : 'image/*'}
                  maxSizeMB={ad.mediaType === 'video' ? 50 : 5}
                  label="Upload Mobile Media"
                  placeholder="Leave empty for desktop media"
                  previewHeight="h-20"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Target URL (optional)</Label>
                <Input
                  value={ad.targetUrl ?? ''}
                  onChange={(e) => updateAd(i, { targetUrl: e.target.value })}
                  placeholder="/promo"
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Position</Label>
                <Select
                  value={ad.position}
                  onValueChange={(val) =>
                    updateAd(i, { position: val as WebsiteAdData['position'] })
                  }
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="header">Top of page (above header)</SelectItem>
                    <SelectItem value="between_sections">Between sections</SelectItem>
                    <SelectItem value="sidebar">Sidebar</SelectItem>
                    <SelectItem value="popup">Popup</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {ad.position === 'between_sections' && (
                <div className="space-y-1">
                  <Label className="text-xs">Display After Section</Label>
                  <Select
                    value={ad.displayAfterSection ?? ''}
                    onValueChange={(val) => updateAd(i, { displayAfterSection: val })}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Select section..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hero">After Hero</SelectItem>
                      <SelectItem value="categories">After Categories</SelectItem>
                      <SelectItem value="solutionsByConcern">After Solutions</SelectItem>
                      <SelectItem value="shopByConcern">After Shop by Concern</SelectItem>
                      <SelectItem value="giftBox">After Gift Box</SelectItem>
                      <SelectItem value="latestProducts">After Latest Products</SelectItem>
                      <SelectItem value="promoBanner">After Promo Banner</SelectItem>
                      <SelectItem value="bestSelling">After Best Selling</SelectItem>
                      <SelectItem value="testimonials">After Testimonials</SelectItem>
                      <SelectItem value="storesBanner">After Stores Banner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs">Start Date (optional)</Label>
                <Input
                  type="datetime-local"
                  value={ad.startsAt ? ad.startsAt.slice(0, 16) : ''}
                  onChange={(e) =>
                    updateAd(i, {
                      startsAt: e.target.value || undefined,
                    } as Partial<WebsiteAdData>)
                  }
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">End Date (optional)</Label>
                <Input
                  type="datetime-local"
                  value={ad.endsAt ? ad.endsAt.slice(0, 16) : ''}
                  onChange={(e) =>
                    updateAd(i, {
                      endsAt: e.target.value || undefined,
                    } as Partial<WebsiteAdData>)
                  }
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </div>
        ))}

        {ads.length === 0 && (
          <div className="text-center py-8 text-sand text-sm border border-dashed border-mist rounded-lg">
            No advertisements yet. Add promotional banners that appear between sections.
          </div>
        )}
      </div>
    </div>
  );
}
