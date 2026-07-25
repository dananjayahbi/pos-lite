'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { MediaUploader } from '@/components/shared/MediaUploader';
import type { WebsiteConfigData, WebsiteHeroSlideData } from '@/types/website.types';

interface HeroSlidesTabProps {
  tenantId: string;
  config: WebsiteConfigData;
  onChange: (updates: Partial<WebsiteConfigData>) => void;
}

export function HeroSlidesTab({ config, onChange }: HeroSlidesTabProps) {
  const slides: WebsiteHeroSlideData[] = config.heroSlides ?? [];
  const [saving, setSaving] = useState(false);

  const addSlide = () => {
    const newSlide: WebsiteHeroSlideData = {
      mediaType: 'image',
      mediaUrl: '',
      isActive: true,
      sortOrder: slides.length,
    };
    onChange({ heroSlides: [...slides, newSlide] });
  };

  const updateSlide = (index: number, updates: Partial<WebsiteHeroSlideData>) => {
    const updated = slides.map((s, i) => (i === index ? { ...s, ...updates } : s));
    onChange({ heroSlides: updated });
  };

  const removeSlide = (index: number) => {
    onChange({ heroSlides: slides.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-espresso">Hero Banner</h3>
          <p className="text-xs text-sand mt-1">
            The first active slide is displayed as the main hero banner (single image or video).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={addSlide}>
          <Plus className="h-4 w-4 mr-1" /> Add Slide
        </Button>
      </div>

      <div className="space-y-4">
        {slides.map((slide, i) => (
          <div key={i} className="border border-mist rounded-lg p-4 bg-white space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-sand cursor-grab" />
                <span className="text-sm font-medium">Slide {i + 1}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Active</Label>
                  <Switch
                    checked={slide.isActive}
                    onCheckedChange={(checked) => updateSlide(i, { isActive: checked })}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeSlide(i)}
                  className="text-terracotta"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Media Type</Label>
                <Select
                  value={slide.mediaType}
                  onValueChange={(val) => updateSlide(i, { mediaType: val as 'image' | 'video' })}
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

              <div className="space-y-2">
                <Label className="text-xs">Sort Order</Label>
                <Input
                  type="number"
                  value={slide.sortOrder}
                  onChange={(e) => updateSlide(i, { sortOrder: parseInt(e.target.value) || 0 })}
                  className="h-8 text-sm"
                  min={0}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label className="text-xs">
                  {slide.mediaType === 'video' ? 'Video' : 'Image'} (Desktop)
                </Label>
                <MediaUploader
                  value={slide.mediaUrl}
                  onChange={(url) => updateSlide(i, { mediaUrl: url })}
                  accept={slide.mediaType === 'video' ? 'video/*' : 'image/*'}
                  maxSizeMB={slide.mediaType === 'video' ? 100 : 10}
                  label={slide.mediaType === 'video' ? 'Upload Video' : 'Upload Image'}
                  placeholder={
                    slide.mediaType === 'video'
                      ? 'Upload hero video (MP4/WebM)'
                      : 'Upload hero image (JPG/PNG/WebP)'
                  }
                  previewHeight="h-24"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label className="text-xs">Mobile Media (optional)</Label>
                <MediaUploader
                  value={slide.mobileMediaUrl ?? ''}
                  onChange={(url) => updateSlide(i, { mobileMediaUrl: url })}
                  accept={slide.mediaType === 'video' ? 'video/*' : 'image/*'}
                  maxSizeMB={slide.mediaType === 'video' ? 50 : 5}
                  label="Upload Mobile Media"
                  placeholder="Leave empty to use desktop media"
                  previewHeight="h-20"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Title</Label>
                <Input
                  value={slide.title ?? ''}
                  onChange={(e) => updateSlide(i, { title: e.target.value })}
                  placeholder="Welcome to our store"
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Subtitle</Label>
                <Input
                  value={slide.subtitle ?? ''}
                  onChange={(e) => updateSlide(i, { subtitle: e.target.value })}
                  placeholder="Premium Ayurveda"
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label className="text-xs">Description</Label>
                <Textarea
                  value={slide.description ?? ''}
                  onChange={(e) => updateSlide(i, { description: e.target.value })}
                  placeholder="Short description text..."
                  rows={2}
                  className="text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">CTA Text</Label>
                <Input
                  value={slide.ctaText ?? ''}
                  onChange={(e) => updateSlide(i, { ctaText: e.target.value })}
                  placeholder="Shop Now"
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">CTA Link</Label>
                <Input
                  value={slide.ctaLink ?? ''}
                  onChange={(e) => updateSlide(i, { ctaLink: e.target.value })}
                  placeholder="/shop"
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </div>
        ))}

        {slides.length === 0 && (
          <div className="text-center py-8 text-sand text-sm border border-dashed border-mist rounded-lg">
            No hero banner configured yet. Click &quot;Add Slide&quot; to upload an image or video.
          </div>
        )}
      </div>
    </div>
  );
}
