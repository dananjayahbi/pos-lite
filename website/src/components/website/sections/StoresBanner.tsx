'use client';

import React from 'react';
import Link from 'next/link';
import type { StoresBannerSection } from '@/types/website.types';

interface StoresBannerProps {
  config: Record<string, unknown>;
  websiteConfig: Record<string, unknown>;
  tenantSlug: string;
}

/** Tall image banner (800px desktop / 600px mobile). */
export function StoresBanner({ config }: StoresBannerProps) {
  const sectionConfig = config as unknown as StoresBannerSection;

  if (!sectionConfig.desktopImageUrl) return null;

  const BannerContent = (
    <>
      {/* Desktop */}
      <div
        className="hidden md:block site-banner site-banner-bg"
        style={{
          backgroundImage: `url(${sectionConfig.desktopImageUrl})`,
          paddingTop: '800px',
        }}
      />
      {/* Mobile */}
      <div
        className="block md:hidden site-banner site-banner-bg"
        style={{
          backgroundImage: `url(${sectionConfig.mobileImageUrl || sectionConfig.desktopImageUrl})`,
          paddingTop: '600px',
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