'use client';

import { useState } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { DeferredMediaUploader } from '@/components/shared/DeferredMediaUploader';
import { toast } from 'sonner';
import type { WebsiteConfigData } from '@/types/website.types';

interface HeaderTabProps {
  config: WebsiteConfigData;
  onChange: (updates: Partial<WebsiteConfigData>) => void;
}

interface NavItem {
  label: string;
  href: string;
}

const DEFAULT_NAV_ITEMS: NavItem[] = [
  { label: 'SHOP', href: '/shop' },
  { label: 'ABOUT', href: '/about' },
  { label: 'CONTACT', href: '/contact' },
];

export function HeaderTab({ config, onChange }: HeaderTabProps) {
  const navItems: NavItem[] = (config.navItems as NavItem[]) ?? DEFAULT_NAV_ITEMS;

  function handleNavItemChange(index: number, field: 'label' | 'href', value: string) {
    const updated = navItems.map((item, i) =>
      i === index ? { ...item, [field]: value } : item,
    );
    onChange({ navItems: updated } as Partial<WebsiteConfigData>);
  }

  function handleDeleteNavItem(index: number) {
    if (navItems.length <= 1) {
      toast.info('At least one navigation item is required.');
      return;
    }
    const updated = navItems.filter((_, i) => i !== index);
    onChange({ navItems: updated } as Partial<WebsiteConfigData>);
  }

  function handleAddNavItem() {
    const updated = [...navItems, { label: 'New Page', href: '#' }];
    onChange({ navItems: updated } as Partial<WebsiteConfigData>);
  }

  return (
    <div className="space-y-6">
      {/* Section A: Navigation Menu */}
      <div>
        <h3 className="text-sm font-semibold text-espresso">Navigation Menu</h3>
        <p className="mt-1 text-xs text-sand">
          These links appear in the centered navigation bar below the logo. Default: SHOP,
          ABOUT, CONTACT.
        </p>

        <div className="mt-4 space-y-3">
          {navItems.length === 0 ? (
            <p className="text-xs text-sand italic">
              No navigation items. Default menu (SHOP / ABOUT / CONTACT) will be shown.
            </p>
          ) : (
            navItems.map((item, index) => (
              <div
                key={index}
                className="border border-mist rounded-lg bg-white p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-2.5 cursor-grab text-sand shrink-0">
                    <GripVertical className="h-4 w-4" />
                  </div>
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-sand">Label</Label>
                      <Input
                        value={item.label}
                        onChange={(e) =>
                          handleNavItemChange(index, 'label', e.target.value)
                        }
                        placeholder="e.g. SHOP"
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-sand">URL</Label>
                      <Input
                        value={item.href}
                        onChange={(e) =>
                          handleNavItemChange(index, 'href', e.target.value)
                        }
                        placeholder="e.g. /shop"
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="mt-2.5 h-8 w-8 shrink-0 text-sand hover:text-red-500"
                    onClick={() => handleDeleteNavItem(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="mt-3 border-dashed border-mist text-sand hover:text-espresso"
          onClick={handleAddNavItem}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Item
        </Button>
      </div>

      <Separator />

      {/* Section B: Logo */}
      <div>
        <h3 className="text-sm font-semibold text-espresso">Logo</h3>
        <p className="mt-1 text-xs text-sand">
          Upload your site logo. PNG or WebP format recommended for best quality.
        </p>

        <div className="mt-4">
          <DeferredMediaUploader
            uploadKey="header_logo"
            accept="image/*"
            maxSizeMB={5}
            label="Logo"
            placeholder="Upload site logo (PNG/WebP recommended)"
            previewHeight="h-20"
            value={config.logoUrl ?? ''}
            currentRealUrl={config.logoUrl ?? undefined}
            onChange={(url: string) => onChange({ logoUrl: url })}
          />
        </div>
      </div>
    </div>
  );
}
