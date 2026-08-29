'use client';

import React from 'react';
import { useRevealOnScroll } from '@/hooks/useRevealOnScroll';

interface AboutMissionSectionProps {
  title?: string;
  content?: string;
}

/**
 * "Our Mission" — centered italic pull-quote (reference: `#about-mission`).
 * Frames the quote with a heading, hairline divider and large italic accent
 * typography.
 */
export function AboutMissionSection({
  title,
  content,
}: AboutMissionSectionProps) {
  const ref = useRevealOnScroll<HTMLDivElement>();

  if (!content) return null;

  return (
    <section className="relative w-full py-16 sm:py-24 lg:py-32 overflow-hidden border-t border-white/5 bg-[#051610]">
      <div ref={ref} className="relative z-10 max-w-5xl mx-auto px-6 sm:px-10 lg:px-16 text-center">
        {title && <h2 className="mission-title">{title}</h2>}
        <div className="w-16 h-[2px] bg-[#97c93e]/60 mx-auto mb-8" />
        <p className="mission-text">&ldquo;{content}&rdquo;</p>
      </div>
    </section>
  );
}
