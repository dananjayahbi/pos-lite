'use client';

import React from 'react';
import Link from 'next/link';
import type { PromoBannerSection } from '@/types/website.types';

interface PromoBannerProps {
  config: Record<string, unknown>;
  websiteConfig: Record<string, unknown>;
  tenantSlug: string;
}

/** Full-width promotional banner with optional click-through link. */
export function PromoBanner({ config }: PromoBannerProps) {
  const sectionConfig = config as unknown as PromoBannerSection;

  if (!sectionConfig.desktopImageUrl) return null;

  const BannerContent = (
    <>
      {/* Desktop */}
      <div
        className="hidden md:block site-banner site-banner-bg"
        style={{
          backgroundImage: `url(${sectionConfig.desktopImageUrl})`,
          minHeight: '380px',
        }}
      />
      {/* Mobile */}
      <div
        className="block md:hidden site-banner site-banner-bg"
        style={{
          backgroundImage: `url(${sectionConfig.mobileImageUrl || sectionConfig.desktopImageUrl})`,
          minHeight: '220px',
        }}
      />
    </>
  );

  if (sectionConfig.link) {
    return (
      <section className="website-section">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <Link href={sectionConfig.link} className="site-banner-link">
            <div className="site-banner rounded-lg overflow-hidden shadow-md">{BannerContent}</div>
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="website-section">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="site-banner rounded-lg overflow-hidden shadow-md">{BannerContent}</div>
      </div>
    </section>
  );
}