'use client';

import React from 'react';
import Link from 'next/link';
import type { GiftBoxSection as GiftBoxSectionType } from '@/types/website.types';

interface GiftBoxSectionProps {
  config: Record<string, unknown>;
  websiteConfig: Record<string, unknown>;
  tenantSlug: string;
}

export function GiftBoxSection({ config }: GiftBoxSectionProps) {
  const sectionConfig = config as unknown as GiftBoxSectionType;

  if (!sectionConfig.leftImageUrl && !sectionConfig.rightImageUrl) return null;

  return (
    <section className="gift-box-section">
      <div className="flex flex-col md:flex-row items-stretch">
        {/* Left image */}
        <div className="md:w-1/2 bg-black">
          {sectionConfig.leftImageUrl && (
            <div
              className="w-full bg-cover bg-center"
              style={{
                backgroundImage: `url(${sectionConfig.leftImageUrl})`,
                paddingTop: '100%',
              }}
            />
          )}
        </div>

        {/* Right content */}
        <div className="md:w-1/2 flex flex-col items-center justify-center py-10 md:py-20 px-6 md:px-12 bg-[#ece2d6]">
          {sectionConfig.rightImageUrl && (
            <Link
              href={sectionConfig.link || '#'}
              className="block max-w-sm mx-auto overflow-hidden"
            >
              <img
                src={sectionConfig.rightImageUrl}
                alt={sectionConfig.title || 'Gift Box'}
                className="w-full h-auto transition-transform duration-500 hover:scale-105"
                loading="lazy"
              />
            </Link>
          )}

          {sectionConfig.title && (
            <h3
              className="text-xl md:text-2xl mt-6 mb-2 text-center"
              style={{ fontFamily: 'var(--font-dm-serif), serif' }}
            >
              {sectionConfig.title}
            </h3>
          )}

          {sectionConfig.subtitle && (
            <p className="text-sm text-gray-600 text-center mb-4">
              {sectionConfig.subtitle}
            </p>
          )}

          {sectionConfig.link && sectionConfig.title && (
            <Link
              href={sectionConfig.link}
              className="inline-block px-6 py-2 border border-black text-xs uppercase tracking-wider hover:bg-black hover:text-white transition-colors"
            >
              Shop Now
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
