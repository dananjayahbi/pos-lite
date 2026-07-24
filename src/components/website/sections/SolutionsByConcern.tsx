'use client';

import React from 'react';
import Link from 'next/link';
import type { SolutionsByConcernSection } from '@/types/website.types';

interface SolutionsByConcernProps {
  config: Record<string, unknown>;
  websiteConfig: Record<string, unknown>;
  tenantSlug: string;
}

export function SolutionsByConcern({ config }: SolutionsByConcernProps) {
  const sectionConfig = config as unknown as SolutionsByConcernSection;

  if (!sectionConfig.desktopImageUrl) return null;

  return (
    <section className="py-8 md:py-12 bg-white flex justify-center">
      {sectionConfig.link ? (
        <Link href={sectionConfig.link} className="block">
          <img
            src={sectionConfig.desktopImageUrl}
            alt="Solutions by concern"
            className="hidden md:block mx-auto"
            style={{ maxWidth: '19%', height: 'auto' }}
            loading="lazy"
          />
          <img
            src={sectionConfig.mobileImageUrl || sectionConfig.desktopImageUrl}
            alt="Solutions by concern"
            className="block md:hidden mx-auto"
            style={{ maxWidth: '65%', height: 'auto' }}
            loading="lazy"
          />
        </Link>
      ) : (
        <>
          <img
            src={sectionConfig.desktopImageUrl}
            alt="Solutions by concern"
            className="hidden md:block mx-auto"
            style={{ maxWidth: '19%', height: 'auto' }}
            loading="lazy"
          />
          <img
            src={sectionConfig.mobileImageUrl || sectionConfig.desktopImageUrl}
            alt="Solutions by concern"
            className="block md:hidden mx-auto"
            style={{ maxWidth: '65%', height: 'auto' }}
            loading="lazy"
          />
        </>
      )}
    </section>
  );
}
