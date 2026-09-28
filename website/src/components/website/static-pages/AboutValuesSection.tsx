'use client';

import React from 'react';
import { useRevealOnScroll } from '@/hooks/useRevealOnScroll';

interface ValueItem {
  title: string;
  description: string;
}

interface AboutValuesSectionProps {
  title?: string;
  values?: ValueItem[];
}

/**
 * "Our Values" — numbered luxury card grid (reference: `#about-values`).
 * Renders a responsive 1/2/4-column grid of cards, each with a big green
 * index number, serif title and muted description.
 */
export function AboutValuesSection({
  title,
  values,
}: AboutValuesSectionProps) {
  const gridRef = useRevealOnScroll<HTMLDivElement>();
  const headerRef = useRevealOnScroll<HTMLDivElement>();

  if (!values || values.length === 0) return null;

  return (
    <section className="relative w-full py-16 sm:py-24 lg:py-32 overflow-hidden border-t border-white/5 bg-[#051610]">
      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
        <div ref={headerRef} className="text-center mb-14 sm:mb-20">
          {title && (
            <h2
              className="text-3xl sm:text-4xl md:text-5xl font-cinzel font-bold text-white tracking-wide leading-tight"
              style={{ fontFamily: 'var(--font-serif), serif' }}
            >
              {title}
            </h2>
          )}
          <div className="w-16 h-[2px] bg-[#97c93e]/60 mx-auto mt-4" />
        </div>

        <div
          ref={gridRef}
          className="values-grid"
        >
          {values.map((value, i) => (
            <div key={i} className="value-card group select-none">
              <div>
                <span className="value-num">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="value-title">{value.title}</h3>
                <p className="value-desc">{value.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
