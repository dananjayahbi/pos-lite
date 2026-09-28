'use client';

import React from 'react';
import type { PublicProduct } from '@/types/website.types';

interface ProductHealthSectionsProps {
  product: PublicProduct;
}

interface Section {
  key: string;
  title: string;
  content: string;
  /** Emoji glyph to warm up each block. */
  icon: string;
}

/**
 * A reusable, styled renderer for the four Ayurvedic health-content sections.
 * Rendered as a vertical stack of bordered cards with an icon so the content
 * has presence instead of reading as bare paragraphs.
 */
export function ProductHealthSections({ product }: ProductHealthSectionsProps) {
  const sections: Section[] = [
    {
      key: 'ingredients',
      title: 'Active Ingredients',
      content: product.activeIngredients ?? '',
      icon: '🌿',
    },
    { key: 'usage', title: 'How to Use', content: product.usageInstructions ?? '', icon: '💧' },
    { key: 'benefits', title: 'Benefits', content: product.healthBenefits ?? '', icon: '✨' },
    { key: 'precautions', title: 'Precautions', content: product.safetyPrecautions ?? '', icon: '⚠️' },
  ].filter((s) => s.content.trim().length > 0);

  if (sections.length === 0) return null;

  return (
    <div className="mt-10 grid gap-4 sm:grid-cols-2">
      {sections.map((section) => (
        <div
          key={section.key}
          className="rounded-xl border border-white/10 bg-[#082017] p-5"
        >
          <h3
            className="flex items-center gap-2 text-base font-semibold uppercase tracking-wide text-white"
            style={{ fontFamily: 'var(--font-serif), serif' }}
          >
            <span aria-hidden>{section.icon}</span>
            {section.title}
          </h3>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#cbd5e1]">
            {section.content}
          </p>
        </div>
      ))}
    </div>
  );
}
