'use client';

import React from 'react';
import { useRevealOnScroll } from '@/hooks/useRevealOnScroll';

interface SectionTitleProps {
  label?: string;
  title: string;
  subtitle?: string;
  reveal?: boolean;
  align?: 'center' | 'left';
}

/**
 * Centered luxury section header used across every dark section.
 *   label    → small uppercase green eyebrow (e.g. "AUTHENTIC AYURVEDIC CARE")
 *   title    → the big Cinzel heading
 *   subtitle → optional muted description
 *   divider  → a 64px green hairline under the title
 */
export function SectionTitle({
  label,
  title,
  subtitle,
  reveal = true,
  align = 'center',
}: SectionTitleProps) {
  const ref = useRevealOnScroll<HTMLDivElement>();
  const alignCls = align === 'center' ? 'text-center mx-auto' : 'text-left mx-0';

  return (
    <div
      ref={reveal ? ref : undefined}
      className={`relative z-10 max-w-4xl px-6 mb-10 sm:mb-14 ${alignCls}`}
      style={align === 'center' ? { maxWidth: '56rem' } : undefined}
    >
      {label && (
        <span className="text-xs font-semibold tracking-[0.3em] uppercase text-[#97c93e] block mb-2 font-sans">
          {label}
        </span>
      )}
      <h2 className="text-3xl sm:text-4xl md:text-5xl font-cinzel font-bold text-white tracking-wide leading-tight">
        {title}
      </h2>
      <div className="w-16 h-[2px] bg-[#97c93e]/60 my-4 rounded-full" />
      {subtitle && (
        <p className="text-xs sm:text-sm text-gray-400 font-light leading-relaxed max-w-2xl mx-auto">
          {subtitle}
        </p>
      )}
    </div>
  );
}
