'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import type { WebsiteConfigData } from '@/types/website.types';

interface GeneralTabProps {
  config: WebsiteConfigData;
  onChange: (updates: Partial<WebsiteConfigData>) => void;
}

export function GeneralTab({ config, onChange }: GeneralTabProps) {
  return (
    <div className="space-y-6">
      {/* Branding */}
      <div>
        <h3 className="text-sm font-semibold text-espresso mb-3">Branding</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="siteName">Site Name</Label>
            <Input
              id="siteName"
              value={config.siteName ?? ''}
              onChange={(e) => onChange({ siteName: e.target.value })}
              placeholder="Your Business Name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tagline">Tagline</Label>
            <Input
              id="tagline"
              value={config.tagline ?? ''}
              onChange={(e) => onChange({ tagline: e.target.value })}
              placeholder="Premium Ayurveda Skincare"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Logo & Favicon */}
      <div>
        <h3 className="text-sm font-semibold text-espresso mb-3">Logo & Favicon</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="logoUrl">Logo URL</Label>
            <Input
              id="logoUrl"
              value={config.logoUrl ?? ''}
              onChange={(e) => onChange({ logoUrl: e.target.value })}
              placeholder="https://..."
            />
            {config.logoUrl && (
              <img
                src={config.logoUrl}
                alt="Logo preview"
                className="h-10 mt-2 object-contain"
              />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="faviconUrl">Favicon URL</Label>
            <Input
              id="faviconUrl"
              value={config.faviconUrl ?? ''}
              onChange={(e) => onChange({ faviconUrl: e.target.value })}
              placeholder="https://..."
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Colors */}
      <div>
        <h3 className="text-sm font-semibold text-espresso mb-3">Colors</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="primaryColor">Primary Color</Label>
            <div className="flex gap-2">
              <Input
                id="primaryColor"
                type="color"
                value={config.primaryColor ?? '#0a0a0a'}
                onChange={(e) => onChange({ primaryColor: e.target.value })}
                className="w-12 h-10 p-1 cursor-pointer"
              />
              <Input
                value={config.primaryColor ?? '#0a0a0a'}
                onChange={(e) => onChange({ primaryColor: e.target.value })}
                className="flex-1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="accentColor">Accent Color</Label>
            <div className="flex gap-2">
              <Input
                id="accentColor"
                type="color"
                value={config.accentColor ?? '#b4946e'}
                onChange={(e) => onChange({ accentColor: e.target.value })}
                className="w-12 h-10 p-1 cursor-pointer"
              />
              <Input
                value={config.accentColor ?? '#b4946e'}
                onChange={(e) => onChange({ accentColor: e.target.value })}
                className="flex-1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bgColor">Background Color</Label>
            <div className="flex gap-2">
              <Input
                id="bgColor"
                type="color"
                value={config.bgColor ?? '#ece2d6'}
                onChange={(e) => onChange({ bgColor: e.target.value })}
                className="w-12 h-10 p-1 cursor-pointer"
              />
              <Input
                value={config.bgColor ?? '#ece2d6'}
                onChange={(e) => onChange({ bgColor: e.target.value })}
                className="flex-1"
              />
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* SEO */}
      <div>
        <h3 className="text-sm font-semibold text-espresso mb-3">SEO</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="metaTitle">Meta Title</Label>
            <Input
              id="metaTitle"
              value={config.metaTitle ?? ''}
              onChange={(e) => onChange({ metaTitle: e.target.value })}
              placeholder="Premium Ayurveda Skincare | Your Brand"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="metaDescription">Meta Description</Label>
            <Textarea
              id="metaDescription"
              value={config.metaDescription ?? ''}
              onChange={(e) => onChange({ metaDescription: e.target.value })}
              placeholder="Discover premium Ayurveda skincare products..."
              rows={3}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Social Links */}
      <div>
        <h3 className="text-sm font-semibold text-espresso mb-3">Social Links</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="socialFacebook">Facebook URL</Label>
            <Input
              id="socialFacebook"
              value={config.socialLinks?.facebook ?? ''}
              onChange={(e) =>
                onChange({ socialLinks: { ...config.socialLinks, facebook: e.target.value } })
              }
              placeholder="https://facebook.com/..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="socialInstagram">Instagram URL</Label>
            <Input
              id="socialInstagram"
              value={config.socialLinks?.instagram ?? ''}
              onChange={(e) =>
                onChange({ socialLinks: { ...config.socialLinks, instagram: e.target.value } })
              }
              placeholder="https://instagram.com/..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="socialEmail">Email</Label>
            <Input
              id="socialEmail"
              type="email"
              value={config.socialLinks?.email ?? ''}
              onChange={(e) =>
                onChange({ socialLinks: { ...config.socialLinks, email: e.target.value } })
              }
              placeholder="hello@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="socialPhone">Phone</Label>
            <Input
              id="socialPhone"
              value={config.socialLinks?.phone ?? ''}
              onChange={(e) =>
                onChange({ socialLinks: { ...config.socialLinks, phone: e.target.value } })
              }
              placeholder="+94 77 123 4567"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="socialWhatsapp">WhatsApp Number</Label>
            <Input
              id="socialWhatsapp"
              value={config.socialLinks?.whatsapp ?? ''}
              onChange={(e) =>
                onChange({ socialLinks: { ...config.socialLinks, whatsapp: e.target.value } })
              }
              placeholder="94771234567"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="socialTiktok">TikTok URL</Label>
            <Input
              id="socialTiktok"
              value={config.socialLinks?.tiktok ?? ''}
              onChange={(e) =>
                onChange({ socialLinks: { ...config.socialLinks, tiktok: e.target.value } })
              }
              placeholder="https://tiktok.com/@..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
