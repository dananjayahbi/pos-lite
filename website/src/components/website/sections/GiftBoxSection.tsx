/* eslint-disable @next/next/no-img-element */
'use client';

import React from 'react';
import Link from 'next/link';
import type { GiftBoxSection as GiftBoxSectionType } from '@/types/website.types';

interface GiftBoxSectionProps {
  config: Record<string, unknown>;
  websiteConfig: Record<string, unknown>;
  tenantSlug: string;
}

/** Two-pane split: left image, right CTA + image. */
export function GiftBoxSection({ config }: GiftBoxSectionProps) {
  const sectionConfig = config as unknown as GiftBoxSectionType;

  if (!sectionConfig.leftImageUrl && !sectionConfig.rightImageUrl) return null;

  return (
    <section className="website-section">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-stretch rounded-lg overflow-hidden shadow-sm">
        {/* Left image */}
        <div className="md:w-1/2">
          {sectionConfig.leftImageUrl && (
            <div className="gift-box-image-wrapper h-full min-h-[400px]">
              <div
                className="w-full h-full bg-cover bg-center"
                style={{
                  backgroundImage: `url(${sectionConfig.leftImageUrl})`,
                  minHeight: '400px',
                }}
              />
            </div>
          )}
        </div>

        {/* Right content */}
        <div className="md:w-1/2 flex flex-col items-center justify-center py-12 md:py-20 px-8 md:px-16 bg-[var(--site-light-gray)]">
          {sectionConfig.rightImageUrl && (
            <Link
              href={sectionConfig.link || '#'}
              className="block max-w-xs mx-auto overflow-hidden rounded-lg"
            >
              <img
                src={sectionConfig.rightImageUrl}
                alt={sectionConfig.title || 'Gift Box'}
                className="w-full h-auto"
                loading="lazy"
              />
            </Link>
          )}

          {sectionConfig.title && (
            <h3
              className="text-2xl md:text-3xl mt-8 mb-3 text-center"
              style={{ fontFamily: 'var(--site-heading-font), serif' }}
            >
              {sectionConfig.title}
            </h3>
          )}

          {sectionConfig.subtitle && (
            <p className="text-sm text-gray-600 text-center mb-5 max-w-sm">
              {sectionConfig.subtitle}
            </p>
          )}

          {sectionConfig.link && sectionConfig.title && (
            <Link
              href={sectionConfig.link}
              className="inline-block px-7 py-2.5 border-2 border-black text-xs uppercase tracking-wider font-semibold hover:bg-black hover:text-white transition-colors"
            >
              Shop Now
            </Link>
          )}
        </div>
      </div>
      </div>
    </section>
  );
}