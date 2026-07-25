'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { DeferredMediaUploader } from '@/components/shared/DeferredMediaUploader';
import type { WebsiteConfigData } from '@/types/website.types';

interface ContactPageTabProps {
  config: WebsiteConfigData;
  onChange: (updates: Partial<WebsiteConfigData>) => void;
}

export function ContactPageTab({ config, onChange }: ContactPageTabProps) {
  return (
    <div className="space-y-6">
      {/* Page Info */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="contactPageTitle" className="text-sm font-semibold text-espresso">
            Page Title
          </Label>
          <p className="text-xs text-sand mb-1.5">The heading displayed at the top of the Contact page.</p>
          <Input
            id="contactPageTitle"
            value={config.contactPageTitle ?? ''}
            onChange={(e) => onChange({ contactPageTitle: e.target.value })}
            placeholder="Contact Us"
          />
        </div>

        <div>
          <Label htmlFor="contactPageSubtitle" className="text-sm font-semibold text-espresso">
            Page Subtitle
          </Label>
          <p className="text-xs text-sand mb-1.5">A short subtitle beneath the page title.</p>
          <Input
            id="contactPageSubtitle"
            value={config.contactPageSubtitle ?? ''}
            onChange={(e) => onChange({ contactPageSubtitle: e.target.value })}
            placeholder="We'd love to hear from you"
          />
        </div>

        <div>
          <Label className="text-sm font-semibold text-espresso">Hero Image</Label>
          <p className="text-xs text-sand mb-1.5">The banner image at the top of the Contact page.</p>
          <DeferredMediaUploader
            value={config.contactHeroImageUrl ?? ''}
            onChange={(url: string) => onChange({ contactHeroImageUrl: url })}
            uploadKey="contact_hero"
            accept="image/*"
            maxSizeMB={5}
            label="Upload Hero Image"
            previewHeight="h-20"
            currentRealUrl={config.contactHeroImageUrl ?? ''}
          />
        </div>
      </div>

      <Separator />

      {/* Contact Info */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="contactInfoTitle" className="text-sm font-semibold text-espresso">
            Contact Info Section Title
          </Label>
          <p className="text-xs text-sand mb-1.5">Title above the contact details section.</p>
          <Input
            id="contactInfoTitle"
            value={config.contactInfoTitle ?? ''}
            onChange={(e) => onChange({ contactInfoTitle: e.target.value })}
            placeholder="Get in Touch"
          />
        </div>

        <div>
          <Label htmlFor="contactAddress" className="text-sm font-semibold text-espresso">
            Address
          </Label>
          <p className="text-xs text-sand mb-1.5">Your physical store or office address.</p>
          <Textarea
            id="contactAddress"
            value={config.contactAddress ?? ''}
            onChange={(e) => onChange({ contactAddress: e.target.value })}
            placeholder="123 Main Street, City, State 12345"
            rows={2}
          />
        </div>

        <div>
          <Label htmlFor="contactPhone" className="text-sm font-semibold text-espresso">
            Phone Display
          </Label>
          <p className="text-xs text-sand mb-1.5">The phone number shown on the contact page.</p>
          <Input
            id="contactPhone"
            value={config.contactPhoneDisplay ?? ''}
            onChange={(e) => onChange({ contactPhoneDisplay: e.target.value })}
            placeholder="+1 (555) 000-0000"
          />
        </div>

        <div>
          <Label htmlFor="contactEmail" className="text-sm font-semibold text-espresso">
            Email Display
          </Label>
          <p className="text-xs text-sand mb-1.5">The email address shown on the contact page.</p>
          <Input
            id="contactEmail"
            type="email"
            value={config.contactEmailDisplay ?? ''}
            onChange={(e) => onChange({ contactEmailDisplay: e.target.value })}
            placeholder="hello@yourstore.com"
          />
        </div>

        <div>
          <Label htmlFor="contactBusinessHours" className="text-sm font-semibold text-espresso">
            Business Hours
          </Label>
          <p className="text-xs text-sand mb-1.5">Display your operating hours. Use line breaks or commas to separate days.</p>
          <Input
            id="contactBusinessHours"
            value={config.contactBusinessHours ?? ''}
            onChange={(e) => onChange({ contactBusinessHours: e.target.value })}
            placeholder="Mon–Fri: 9am–6pm, Sat: 10am–4pm"
          />
        </div>

        <div>
          <Label htmlFor="contactMapEmbedUrl" className="text-sm font-semibold text-espresso">
            Map Embed URL
          </Label>
          <p className="text-xs text-sand mb-1.5">
            Paste a Google Maps iframe src URL to embed a map on the contact page.
          </p>
          <Textarea
            id="contactMapEmbedUrl"
            value={config.contactMapEmbedUrl ?? ''}
            onChange={(e) => onChange({ contactMapEmbedUrl: e.target.value })}
            placeholder="https://www.google.com/maps/embed?..."
            rows={3}
          />
        </div>
      </div>
    </div>
  );
}
