'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Star } from 'lucide-react';
import type { WebsiteConfigData, TestimonialItem, TestimonialsSection } from '@/types/website.types';

interface TestimonialsTabProps {
  config: WebsiteConfigData;
  onChange: (updates: Partial<WebsiteConfigData>) => void;
}

export function TestimonialsTab({ config, onChange }: TestimonialsTabProps) {
  const sections = config.sections ?? {};
  const sectionConfig = (sections.testimonials as unknown as TestimonialsSection) ?? {
    isActive: true,
    sortOrder: 9,
    title: 'Testimonials',
    subtitle: 'What our *customers* say',
    items: [],
  };

  const items: TestimonialItem[] = sectionConfig.items ?? [];

  const updateSection = (updates: Partial<TestimonialsSection>) => {
    onChange({
      sections: {
        ...sections,
        testimonials: { ...sectionConfig, ...updates },
      },
    });
  };

  const updateItem = (index: number, updates: Partial<TestimonialItem>) => {
    const updated = items.map((item, i) => (i === index ? { ...item, ...updates } : item));
    updateSection({ items: updated });
  };

  const addItem = () => {
    updateSection({
      items: [
        ...items,
        {
          customerName: 'Customer Name',
          customerTitle: 'Verified Customer',
          quote: 'Amazing products!',
          rating: 5,
          sortOrder: items.length,
          isActive: true,
        },
      ],
    });
  };

  const removeItem = (index: number) => {
    updateSection({ items: items.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-6">
      {/* Section header config */}
      <div>
        <h3 className="text-sm font-semibold text-espresso mb-3">Testimonials Section</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Section Title (eyebrow)</Label>
            <Input
              value={sectionConfig.title ?? 'Testimonials'}
              onChange={(e) => updateSection({ title: e.target.value })}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label className="text-xs">
              Subtitle (use *text* for italic gold text)
            </Label>
            <Input
              value={sectionConfig.subtitle ?? ''}
              onChange={(e) => updateSection({ subtitle: e.target.value })}
              placeholder="What our *customers* say"
              className="h-8 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-espresso">Testimonial Items</h3>
        <Button variant="outline" size="sm" onClick={addItem}>
          <Plus className="h-4 w-4 mr-1" /> Add Testimonial
        </Button>
      </div>

      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={item.id ?? i} className="border border-mist rounded-lg p-4 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Testimonial {i + 1}</span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Active</Label>
                  <Switch
                    checked={item.isActive}
                    onCheckedChange={(checked) => updateItem(i, { isActive: checked })}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(i)}
                  className="text-terracotta"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Customer Name</Label>
                <Input
                  value={item.customerName}
                  onChange={(e) => updateItem(i, { customerName: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Customer Title</Label>
                <Input
                  value={item.customerTitle ?? ''}
                  onChange={(e) => updateItem(i, { customerTitle: e.target.value })}
                  placeholder="Verified Customer"
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Quote</Label>
              <Textarea
                value={item.quote}
                onChange={(e) => updateItem(i, { quote: e.target.value })}
                rows={2}
                className="text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Rating</Label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => updateItem(i, { rating: star })}
                    className="focus:outline-none"
                  >
                    <Star
                      size={18}
                      fill={star <= item.rating ? '#b4946e' : 'none'}
                      color={star <= item.rating ? '#b4946e' : '#ccc'}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <div className="text-center py-8 text-sand text-sm border border-dashed border-mist rounded-lg">
            No testimonials yet. Add customer reviews to build trust.
          </div>
        )}
      </div>
    </div>
  );
}
