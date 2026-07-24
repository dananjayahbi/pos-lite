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
          paddingTop: '250px',
        }}
      />
      {/* Mobile */}
      <div
        className="block md:hidden site-banner site-banner-bg"
        style={{
          backgroundImage: `url(${sectionConfig.mobileImageUrl || sectionConfig.desktopImageUrl})`,
          paddingTop: '56.25%',
        }}
      />
    </>
  );

  if (sectionConfig.link) {
    return (
      <section>
        <Link href={sectionConfig.link} className="block">
          {BannerContent}
        </Link>
      </section>
    );
  }

  return <section>{BannerContent}</section>;
}