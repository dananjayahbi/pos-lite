'use client';

import React from 'react';
import type { InfoAdSection } from '@/types/website.types';

interface InfoAdPreviewProps {
  config: Record<string, unknown>;
  websiteConfig: Record<string, unknown>;
  tenantSlug: string;
}

/**
 * Lightweight ERP preview for the Info Ad section (Section 04).
 * Renders a two-column info/ad block preview.
 */
export function InfoAdPreview({ config }: InfoAdPreviewProps) {
  const sectionConfig = config as unknown as InfoAdSection;

  if (!sectionConfig.desktopImageUrl && !sectionConfig.title && !sectionConfig.subtitle) {
    return null;
  }

  return (
    <section className="bg-white py-6">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 md:grid-cols-2">
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
          {sectionConfig.buttonText && (
            <span className="mt-2 inline-block w-fit rounded-md bg-espresso px-4 py-2 text-xs font-medium text-white">
              {sectionConfig.buttonText}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
