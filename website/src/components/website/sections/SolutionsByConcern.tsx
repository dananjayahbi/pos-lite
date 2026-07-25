/* eslint-disable @next/next/no-img-element */
'use client';

import React from 'react';
import Link from 'next/link';
import type { SolutionsByConcernSection } from '@/types/website.types';

interface SolutionsByConcernProps {
  config: Record<string, unknown>;
  websiteConfig: Record<string, unknown>;
  tenantSlug: string;
}

/** Full-width banner image with desktop/mobile variants and optional link. */
export function SolutionsByConcern({ config }: SolutionsByConcernProps) {
  const sectionConfig = config as unknown as SolutionsByConcernSection;

  if (!sectionConfig.desktopImageUrl) return null;

  const content = (
    <>
      <img
        src={sectionConfig.desktopImageUrl}
        alt="Solutions by concern"
        className="hidden md:block w-full"
        loading="lazy"
      />
      <img
        src={sectionConfig.mobileImageUrl || sectionConfig.desktopImageUrl}
        alt="Solutions by concern"
        className="block md:hidden w-full"
        loading="lazy"
      />
    </>
  );

  return (
    <section className="website-section">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        {sectionConfig.link ? (
          <Link href={sectionConfig.link} className="site-banner-link">
            <div className="site-banner rounded-lg overflow-hidden shadow-md">{content}</div>
          </Link>
        ) : (
          <div className="site-banner rounded-lg overflow-hidden shadow-md">{content}</div>
        )}
      </div>
    </section>
  );
}