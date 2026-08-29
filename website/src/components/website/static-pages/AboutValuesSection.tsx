'use client';

import React from 'react';

interface ValueItem {
  title: string;
  description: string;
}

interface AboutValuesSectionProps {
  title?: string;
  values?: ValueItem[];
}

const VALUE_ICONS = [
  // Using simple CSS-styled icons rather than importing lucide-react
  '✦',
  '◆',
  '◈',
  '⬡',
  '✿',
  '❖',
  '★',
  '●',
] as const;

export function AboutValuesSection({
  title,
  values,
}: AboutValuesSectionProps) {
  if (!values || values.length === 0) return null;

  return (
    <section className="py-12 md:py-16 -mx-4 px-4 md:mx-0 md:px-0 md:rounded-xl">
      <div className="max-w-4xl mx-auto">
        {title && (
          <h2
            className="text-2xl md:text-3xl font-medium mb-8 text-center text-white"
            style={{ fontFamily: 'var(--font-serif), serif' }}
          >
            {title}
          </h2>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {values.map((value, i) => (
            <div
              key={i}
              className="rounded-2xl bg-[#0d2e22]/70 p-6 border border-white/10 backdrop-blur-sm transition-shadow duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
            >
              <div className="text-2xl text-[#97c93e] mb-3">
                {VALUE_ICONS[i % VALUE_ICONS.length]}
              </div>
              <h3 className="text-base font-semibold text-white mb-2">
                {value.title}
              </h3>
              <p className="text-sm text-[#cbd5e1] leading-relaxed">
                {value.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
