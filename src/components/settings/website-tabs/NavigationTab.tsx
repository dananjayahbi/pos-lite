'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import type { WebsiteConfigData, WebsiteNavItem } from '@/types/website.types';

interface NavigationTabProps {
  config: WebsiteConfigData;
  onChange: (updates: Partial<WebsiteConfigData>) => void;
}

export function NavigationTab({ config, onChange }: NavigationTabProps) {
  const navItems: WebsiteNavItem[] = (config.navItems as WebsiteNavItem[]) ?? [];

  const addItem = () => {
    onChange({ navItems: [...navItems, { label: 'New Page', href: '#' }] });
  };

  const updateItem = (index: number, updates: Partial<WebsiteNavItem>) => {
    const updated = navItems.map((item, i) =>
      i === index ? { ...item, ...updates } : item
    );
    onChange({ navItems: updated });
  };

  const removeItem = (index: number) => {
    onChange({ navItems: navItems.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-espresso">Navigation Menu Items</h3>
        <Button variant="outline" size="sm" onClick={addItem}>
          <Plus className="h-4 w-4 mr-1" /> Add Item
        </Button>
      </div>

      <p className="text-xs text-sand">
        These links appear in the centered navigation bar below the logo.
        Drag to reorder (coming soon).
      </p>

      <div className="space-y-3">
        {navItems.map((item, i) => (
          <div
            key={i}
            className="flex items-start gap-3 p-3 border border-mist rounded-lg bg-white"
          >
            <GripVertical className="h-5 w-5 text-sand mt-2 flex-shrink-0 cursor-grab" />
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Label</Label>
                <Input
                  value={item.label}
                  onChange={(e) => updateItem(i, { label: e.target.value })}
                  placeholder="Home"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">URL</Label>
                <Input
                  value={item.href}
                  onChange={(e) => updateItem(i, { href: e.target.value })}
                  placeholder="/shop"
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeItem(i)}
              className="text-terracotta hover:text-terracotta/80 flex-shrink-0"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}

        {navItems.length === 0 && (
          <div className="text-center py-8 text-sand text-sm">
            No navigation items yet. Click &quot;Add Item&quot; to create one.
          </div>
        )}
      </div>
    </div>
  );
}
