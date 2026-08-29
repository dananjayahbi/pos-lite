'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { DeferredMediaUploader } from '@/components/shared/DeferredMediaUploader';
import type { WebsiteConfigData } from '@/types/website.types';

interface AboutPageTabProps {
  config: WebsiteConfigData;
  onChange: (updates: Partial<WebsiteConfigData>) => void;
}

interface ValueItem {
  title: string;
  description: string;
}

export function AboutPageTab({ config, onChange }: AboutPageTabProps) {
  const [values, setValues] = useState<ValueItem[]>(config.aboutValues ?? []);

  const syncValues = (newValues: ValueItem[]) => {
    setValues(newValues);
    onChange({ aboutValues: newValues });
  };

  const addValue = () => {
    syncValues([...values, { title: '', description: '' }]);
  };

  const removeValue = (index: number) => {
    syncValues(values.filter((_, i) => i !== index));
  };

  const updateValue = (index: number, field: keyof ValueItem, val: string) => {
    const updated = values.map((item, i) => (i === index ? { ...item, [field]: val } : item));
    syncValues(updated);
  };

  return (
    <div className="space-y-6">
      {/* Page Info */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="aboutPageTitle" className="text-sm font-semibold text-espresso">
            Page Title
          </Label>
          <p className="text-xs text-sand mb-1.5">The heading displayed at the top of the About page.</p>
          <Input
            id="aboutPageTitle"
            value={config.aboutPageTitle ?? ''}
            onChange={(e) => onChange({ aboutPageTitle: e.target.value })}
            placeholder="About Us"
          />
        </div>

        <div>
          <Label htmlFor="aboutPageSubtitle" className="text-sm font-semibold text-espresso">
            Page Subtitle
          </Label>
          <p className="text-xs text-sand mb-1.5">A short subtitle beneath the page title.</p>
          <Input
            id="aboutPageSubtitle"
            value={config.aboutPageSubtitle ?? ''}
            onChange={(e) => onChange({ aboutPageSubtitle: e.target.value })}
            placeholder="Learn more about our story and mission"
          />
        </div>

        <div>
          <Label className="text-sm font-semibold text-espresso">Hero Image</Label>
          <p className="text-xs text-sand mb-1.5">The banner image at the top of the About page.</p>
          <DeferredMediaUploader
            value={config.aboutHeroImageUrl ?? ''}
            onChange={(url: string) => onChange({ aboutHeroImageUrl: url })}
            uploadKey="about_hero"
            accept="image/*"
            maxSizeMB={5}
            label="Upload Hero Image"
            previewHeight="h-20"
            currentRealUrl={config.aboutHeroImageUrl ?? ''}
          />
        </div>
      </div>

      <Separator />

      {/* Story Section */}
      <div className="space-y-4">
        <div className="rounded-lg border border-cream/40 bg-cream/20 px-3 py-2">
          <h3 className="text-sm font-semibold text-espresso">Our Story</h3>
          <p className="mt-0.5 text-xs text-sand">
            Split editorial section. A 4:5 rounded image frame beside a titled
            paragraph block with a dropcap on the first sentence.
          </p>
        </div>
        <div>
          <Label htmlFor="aboutStoryTitle" className="text-sm font-semibold text-espresso">
            Story Title
          </Label>
          <p className="text-xs text-sand mb-1.5">Title for the &quot;Our Story&quot; section.</p>
          <Input
            id="aboutStoryTitle"
            value={config.aboutStoryTitle ?? ''}
            onChange={(e) => onChange({ aboutStoryTitle: e.target.value })}
            placeholder="Our Story"
          />
        </div>

        <div>
          <Label htmlFor="aboutStoryContent" className="text-sm font-semibold text-espresso">
            Story Content
          </Label>
          <p className="text-xs text-sand mb-1.5">Tell your brand&apos;s story. Each line becomes a paragraph.</p>
          <Textarea
            id="aboutStoryContent"
            value={config.aboutStoryContent ?? ''}
            onChange={(e) => onChange({ aboutStoryContent: e.target.value })}
            placeholder="It all started when..."
            rows={5}
          />
        </div>

        <div>
          <Label className="text-sm font-semibold text-espresso">Story Image</Label>
          <p className="text-xs text-sand mb-1.5">An image to accompany the story section.</p>
          <DeferredMediaUploader
            value={config.aboutStoryImageUrl ?? ''}
            onChange={(url: string) => onChange({ aboutStoryImageUrl: url })}
            uploadKey="about_story"
            accept="image/*"
            maxSizeMB={5}
            label="Upload Story Image"
            previewHeight="h-20"
            currentRealUrl={config.aboutStoryImageUrl ?? ''}
          />
        </div>
      </div>

      <Separator />

      {/* Mission Section */}
      <div className="space-y-4">
        <div className="rounded-lg border border-cream/40 bg-cream/20 px-3 py-2">
          <h3 className="text-sm font-semibold text-espresso">Our Mission</h3>
          <p className="mt-0.5 text-xs text-sand">
            Centered italic pull-quote. Large serif heading with a green hairline
            divider above the quote.
          </p>
        </div>
        <div>
          <Label htmlFor="aboutMissionTitle" className="text-sm font-semibold text-espresso">
            Mission Title
          </Label>
          <p className="text-xs text-sand mb-1.5">Title for the &quot;Our Mission&quot; section.</p>
          <Input
            id="aboutMissionTitle"
            value={config.aboutMissionTitle ?? ''}
            onChange={(e) => onChange({ aboutMissionTitle: e.target.value })}
            placeholder="Our Mission"
          />
        </div>

        <div>
          <Label htmlFor="aboutMissionContent" className="text-sm font-semibold text-espresso">
            Mission Content
          </Label>
          <p className="text-xs text-sand mb-1.5">Describe your brand&apos;s mission.</p>
          <Textarea
            id="aboutMissionContent"
            value={config.aboutMissionContent ?? ''}
            onChange={(e) => onChange({ aboutMissionContent: e.target.value })}
            placeholder="We believe in..."
            rows={5}
          />
        </div>
      </div>

      <Separator />

      {/* Values Section */}
      <div className="space-y-4">
        <div className="rounded-lg border border-cream/40 bg-cream/20 px-3 py-2">
          <h3 className="text-sm font-semibold text-espresso">Our Values</h3>
          <p className="mt-0.5 text-xs text-sand">
            Numbered 4-column card grid. Each card shows a big green index, a
            serif title and a muted description.
          </p>
        </div>
        <div>
          <Label htmlFor="aboutValuesTitle" className="text-sm font-semibold text-espresso">
            Values Section Title
          </Label>
          <p className="text-xs text-sand mb-1.5">Title for the values section.</p>
          <Input
            id="aboutValuesTitle"
            value={config.aboutValuesSectionTitle ?? ''}
            onChange={(e) => onChange({ aboutValuesSectionTitle: e.target.value })}
            placeholder="Our Values"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold text-espresso">Values</Label>
            <Button variant="outline" size="sm" onClick={addValue} type="button">
              <Plus className="h-4 w-4 mr-1" />
              Add Value
            </Button>
          </div>

          {values.length === 0 && (
            <p className="text-xs text-sand italic">No values added yet. Click &quot;Add Value&quot; to get started.</p>
          )}

          {values.map((item, index) => (
            <div key={index} className="flex gap-3 items-start border border-sand/20 rounded-lg p-3">
              <GripVertical className="h-5 w-5 text-sand mt-2 shrink-0" />
              <div className="flex-1 space-y-2">
                <Input
                  value={item.title}
                  onChange={(e) => updateValue(index, 'title', e.target.value)}
                  placeholder="Value title (e.g., Integrity)"
                />
                <Textarea
                  value={item.description}
                  onChange={(e) => updateValue(index, 'description', e.target.value)}
                  placeholder="Value description..."
                  rows={2}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-terracotta hover:text-terracotta/80 shrink-0"
                onClick={() => removeValue(index)}
                type="button"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Phone CTA Section */}
      <div className="space-y-4">
        <div className="rounded-lg border border-cream/40 bg-cream/20 px-3 py-2">
          <h3 className="text-sm font-semibold text-espresso">Call To Action (Phone)</h3>
          <p className="mt-0.5 text-xs text-sand">
            The phone button shown in the &quot;Connect With Us&quot; section at the
            bottom of the About page. Leave the number empty to hide the button.
          </p>
        </div>
        <div>
          <Label htmlFor="aboutPhoneLabel" className="text-sm font-semibold text-espresso">
            Button Label
          </Label>
          <p className="text-xs text-sand mb-1.5">Text shown on the phone button.</p>
          <Input
            id="aboutPhoneLabel"
            value={config.aboutPhoneLabel ?? ''}
            onChange={(e) => onChange({ aboutPhoneLabel: e.target.value })}
            placeholder="Call Us"
          />
        </div>

        <div>
          <Label htmlFor="aboutPhoneNumber" className="text-sm font-semibold text-espresso">
            Phone Number
          </Label>
          <p className="text-xs text-sand mb-1.5">
            The number dialled when the button is tapped (e.g. +94 11 234 5678).
          </p>
          <Input
            id="aboutPhoneNumber"
            value={config.aboutPhoneNumber ?? ''}
            onChange={(e) => onChange({ aboutPhoneNumber: e.target.value })}
            placeholder="+94 11 234 5678"
          />
        </div>
      </div>
    </div>
  );
}
