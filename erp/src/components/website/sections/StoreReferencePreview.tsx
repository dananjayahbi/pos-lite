'use client';

import React from 'react';
import type { StoreReferenceSection } from '@/types/website.types';

interface StoreReferencePreviewProps {
  config: Record<string, unknown>;
  websiteConfig: Record<string, unknown>;
  tenantSlug: string;
}

/**
 * Lightweight ERP preview for the Store Reference section (Section 08).
 * Renders a store image + details preview.
 */
export function StoreReferencePreview({ config }: StoreReferencePreviewProps) {
  const sectionConfig = config as unknown as StoreReferenceSection;

  if (!sectionConfig.desktopImageUrl && !sectionConfig.title && !sectionConfig.subtitle) {
    return null;
  }

  return (
    <section className="bg-white py-6">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-4 px-4 md:grid-cols-2">
        {sectionConfig.desktopImageUrl ? (
          <img
            src={sectionConfig.desktopImageUrl}
            alt=""
            className="h-56 w-full rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-56 items-center justify-center rounded-lg bg-mist/40 text-xs text-sand">
            No image
          </div>
        )}
        <div className="flex flex-col justify-center gap-2">
          {sectionConfig.title && (
            <h3 className="text-lg font-semibold text-espresso">{sectionConfig.title}</h3>
          )}
          {sectionConfig.subtitle && (
            <p className="text-sm text-sand">{sectionConfig.subtitle}</p>
          )}
          {sectionConfig.addressLine1 && (
            <p className="text-xs text-sand">{sectionConfig.addressLine1}</p>
          )}
          {sectionConfig.addressLine2 && (
            <p className="text-xs text-sand">{sectionConfig.addressLine2}</p>
          )}
        </div>
      </div>
    </section>
  );
}
