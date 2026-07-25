'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { MediaUploader } from '@/components/shared/MediaUploader';
import { Trash2, Plus } from 'lucide-react';
import type { WebsiteConfigData } from '@/types/website.types';

interface AboutContactTabProps {
  config: WebsiteConfigData;
  onChange: (updates: Partial<WebsiteConfigData>) => void;
}

export function AboutContactTab({ config, onChange }: AboutContactTabProps) {
  // ── About Values ──────────────────────────────────────────────────────────

  const aboutValues = config.aboutValues ?? [];

  const addValue = () => {
    onChange({
      aboutValues: [...aboutValues, { title: '', description: '' }],
    });
  };

  const updateValue = (index: number, updates: Partial<{ title: string; description: string }>) => {
    const updated = aboutValues.map((v, i) =>
      i === index ? { ...v, ...updates } : v,
    );
    onChange({ aboutValues: updated });
  };

  const removeValue = (index: number) => {
    onChange({ aboutValues: aboutValues.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-8">
      {/* ── About Page ─────────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-base font-semibold text-espresso mb-1">About Page</h3>
        <p className="text-xs text-sand mb-4">
          Configure the content shown on the /about page of your storefront.
        </p>

        <div className="space-y-4">
          {/* Page hero */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="aboutPageTitle">Page Title</Label>
              <Input
                id="aboutPageTitle"
                value={config.aboutPageTitle ?? ''}
                onChange={(e) => onChange({ aboutPageTitle: e.target.value })}
                placeholder="About Us"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aboutPageSubtitle">Page Subtitle</Label>
              <Input
                id="aboutPageSubtitle"
                value={config.aboutPageSubtitle ?? ''}
                onChange={(e) => onChange({ aboutPageSubtitle: e.target.value })}
                placeholder="Learn more about our story..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Hero Image</Label>
            <MediaUploader
              value={config.aboutHeroImageUrl ?? ''}
              onChange={(url) => onChange({ aboutHeroImageUrl: url })}
              accept="image/*"
              maxSizeMB={5}
              label="Upload Hero Image"
              placeholder="Optional banner image for the about page"
              previewHeight="h-20"
            />
          </div>

          <Separator />

          {/* Story section */}
          <div>
            <h4 className="text-sm font-medium text-espresso mb-3">Story Section</h4>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="aboutStoryTitle">Story Title</Label>
                  <Input
                    id="aboutStoryTitle"
                    value={config.aboutStoryTitle ?? ''}
                    onChange={(e) => onChange({ aboutStoryTitle: e.target.value })}
                    placeholder="Our Story"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Story Image</Label>
                  <MediaUploader
                    value={config.aboutStoryImageUrl ?? ''}
                    onChange={(url) => onChange({ aboutStoryImageUrl: url })}
                    accept="image/*"
                    maxSizeMB={5}
                    label="Upload Story Image"
                    placeholder="Optional image for the story section"
                    previewHeight="h-20"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="aboutStoryContent">Story Content</Label>
                <Textarea
                  id="aboutStoryContent"
                  value={config.aboutStoryContent ?? ''}
                  onChange={(e) => onChange({ aboutStoryContent: e.target.value })}
                  placeholder="Tell your brand story here..."
                  rows={5}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Mission section */}
          <div>
            <h4 className="text-sm font-medium text-espresso mb-3">Mission Section</h4>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="aboutMissionTitle">Mission Title</Label>
                <Input
                  id="aboutMissionTitle"
                  value={config.aboutMissionTitle ?? ''}
                  onChange={(e) => onChange({ aboutMissionTitle: e.target.value })}
                  placeholder="Our Mission"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="aboutMissionContent">Mission Content</Label>
                <Textarea
                  id="aboutMissionContent"
                  value={config.aboutMissionContent ?? ''}
                  onChange={(e) => onChange({ aboutMissionContent: e.target.value })}
                  placeholder="Describe your mission..."
                  rows={4}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Values section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-espresso">Values Section</h4>
              <Button variant="outline" size="sm" onClick={addValue}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Value
              </Button>
            </div>

            <div className="space-y-2 mb-4">
              <Label htmlFor="aboutValuesSectionTitle">Section Title</Label>
              <Input
                id="aboutValuesSectionTitle"
                value={config.aboutValuesSectionTitle ?? ''}
                onChange={(e) => onChange({ aboutValuesSectionTitle: e.target.value })}
                placeholder="What We Stand For"
              />
            </div>

            {aboutValues.length > 0 && (
              <div className="space-y-3">
                {aboutValues.map((value, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 border border-mist rounded-lg bg-white"
                  >
                    <div className="flex-1 grid grid-cols-1 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Value Title</Label>
                        <Input
                          value={value.title}
                          onChange={(e) => updateValue(i, { title: e.target.value })}
                          placeholder="Quality First"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Description</Label>
                        <Input
                          value={value.description}
                          onChange={(e) => updateValue(i, { description: e.target.value })}
                          placeholder="Brief value description..."
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeValue(i)}
                      className="text-terracotta hover:text-terracotta/80 flex-shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {aboutValues.length === 0 && (
              <p className="text-xs text-sand py-2">
                No values defined. Click &quot;Add Value&quot; to create one.
              </p>
            )}
          </div>
        </div>
      </div>

      <Separator />

      {/* ── Contact Page ───────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-base font-semibold text-espresso mb-1">Contact Page</h3>
        <p className="text-xs text-sand mb-4">
          Configure the content shown on the /contact page of your storefront.
        </p>

        <div className="space-y-4">
          {/* Page title */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contactPageTitle">Page Title</Label>
              <Input
                id="contactPageTitle"
                value={config.contactPageTitle ?? ''}
                onChange={(e) => onChange({ contactPageTitle: e.target.value })}
                placeholder="Contact Us"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPageSubtitle">Page Subtitle</Label>
              <Input
                id="contactPageSubtitle"
                value={config.contactPageSubtitle ?? ''}
                onChange={(e) => onChange({ contactPageSubtitle: e.target.value })}
                placeholder="We'd love to hear from you..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Hero Image</Label>
            <MediaUploader
              value={config.contactHeroImageUrl ?? ''}
              onChange={(url) => onChange({ contactHeroImageUrl: url })}
              accept="image/*"
              maxSizeMB={5}
              label="Upload Hero Image"
              placeholder="Optional banner image for the contact page"
              previewHeight="h-20"
            />
          </div>

          <Separator />

          {/* Contact info */}
          <div>
            <h4 className="text-sm font-medium text-espresso mb-3">Contact Information</h4>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contactInfoTitle">Section Title</Label>
                <Input
                  id="contactInfoTitle"
                  value={config.contactInfoTitle ?? ''}
                  onChange={(e) => onChange({ contactInfoTitle: e.target.value })}
                  placeholder="Get In Touch"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactAddress">Address</Label>
                  <Input
                    id="contactAddress"
                    value={config.contactAddress ?? ''}
                    onChange={(e) => onChange({ contactAddress: e.target.value })}
                    placeholder="123 Main Street, Colombo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPhoneDisplay">Phone (display)</Label>
                  <Input
                    id="contactPhoneDisplay"
                    value={config.contactPhoneDisplay ?? ''}
                    onChange={(e) => onChange({ contactPhoneDisplay: e.target.value })}
                    placeholder="+94 77 123 4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactEmailDisplay">Email (display)</Label>
                  <Input
                    id="contactEmailDisplay"
                    value={config.contactEmailDisplay ?? ''}
                    onChange={(e) => onChange({ contactEmailDisplay: e.target.value })}
                    placeholder="hello@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactBusinessHours">Business Hours</Label>
                  <Input
                    id="contactBusinessHours"
                    value={config.contactBusinessHours ?? ''}
                    onChange={(e) => onChange({ contactBusinessHours: e.target.value })}
                    placeholder="Mon-Fri: 9AM-6PM, Sat: 9AM-1PM"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactMapEmbedUrl">Google Maps Embed URL</Label>
                <Input
                  id="contactMapEmbedUrl"
                  value={config.contactMapEmbedUrl ?? ''}
                  onChange={(e) => onChange({ contactMapEmbedUrl: e.target.value })}
                  placeholder="https://maps.google.com/maps?q=..."
                />
                <p className="text-xs text-sand">
                  Paste a Google Maps embed iframe src URL to show a map on your contact page.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
