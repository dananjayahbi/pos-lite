'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import type { WebsiteConfigData, WebsiteAnnouncementBarData } from '@/types/website.types';

interface AnnouncementBarSettingsFormProps {
  config: WebsiteConfigData;
  onChange: (updates: Partial<WebsiteConfigData>) => void;
}

/**
 * M29-03 (req 3.4) — dedicated editor for the site-wide announcement top-bar.
 *
 * The client asked for "announcement top-bar text/link editor without modifying
 * code"; before this, the only route was the section-level `sections` JSON blob,
 * which is not an editor. Stored in `WebsiteConfig.announcementBar` and rendered
 * by the storefront above the fixed header.
 *
 * Owns its own defaults so the whole object round-trips as one unit: the
 * settings form's `DEFAULT_CONFIG` deliberately does NOT carry `announcementBar`
 * (an absent key leaves the stored value untouched on save, so partial saves
 * like `{ tagline }` never wipe a configured announcement).
 */
const DEFAULT_ANNOUNCEMENT_BAR: WebsiteAnnouncementBarData = {
  text: '',
  link: '',
  isActive: false,
};

export function AnnouncementBarSettingsForm({
  config,
  onChange,
}: AnnouncementBarSettingsFormProps) {
  const announcementBar: WebsiteAnnouncementBarData = {
    ...DEFAULT_ANNOUNCEMENT_BAR,
    ...(config.announcementBar ?? {}),
  };

  const update = (updates: Partial<WebsiteAnnouncementBarData>) => {
    // Send the merged object (not just the changed key) so the stored JSONB
    // always has the complete { text, link, isActive } shape.
    onChange({ announcementBar: { ...announcementBar, ...updates } });
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-espresso">Announcement Bar</h3>
            <p className="text-xs text-text-muted mt-0.5">
              A slim notice shown at the very top of your public website — use it
              for offers, delivery notices or seasonal messages.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Label htmlFor="announcementBarActive" className="text-xs text-text-muted">
              {announcementBar.isActive ? 'Shown' : 'Hidden'}
            </Label>
            <Switch
              id="announcementBarActive"
              checked={announcementBar.isActive ?? false}
              onCheckedChange={(checked) => update({ isActive: checked })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="announcementBarText">Message</Label>
            <Input
              id="announcementBarText"
              value={announcementBar.text ?? ''}
              onChange={(e) => update({ text: e.target.value })}
              placeholder="Free island-wide delivery on orders over Rs. 5,000"
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="announcementBarLink">Link (optional)</Label>
            <Input
              id="announcementBarLink"
              value={announcementBar.link ?? ''}
              onChange={(e) => update({ link: e.target.value })}
              placeholder="/shop"
              maxLength={500}
            />
          </div>
        </div>

        <p className="text-xs text-text-muted mt-2">
          Leave the message empty to hide the bar. The link is only used when the
          message is set.
        </p>
      </div>

      <Separator />
    </div>
  );
}