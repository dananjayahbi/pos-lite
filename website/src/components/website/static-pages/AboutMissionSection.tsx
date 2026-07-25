'use client';

import React from 'react';

interface AboutMissionSectionProps {
  title?: string;
  content?: string;
}

export function AboutMissionSection({
  title,
  content,
}: AboutMissionSectionProps) {
  if (!content) return null;

  return (
    <section className="py-12 md:py-16">
      <div className="max-w-3xl mx-auto text-center">
        {title && (
          <h2
            className="text-2xl md:text-3xl font-medium mb-6 text-[var(--site-primary,#0a0a0a)]"
            style={{ fontFamily: 'var(--font-dm-serif), serif' }}
          >
            {title}
          </h2>
        )}
        <div className="relative">
          {/* Decorative quote mark */}
          <span
            className="absolute -top-4 -left-2 text-6xl text-[var(--site-accent,#b4946e)] opacity-20 leading-none select-none"
            style={{ fontFamily: 'var(--font-dm-serif), serif' }}
          >
            &ldquo;
          </span>
          <div className="prose prose-gray max-w-none relative z-10">
            {content.split('\n').map((paragraph, i) => (
              <p
                key={i}
                className="text-sm md:text-lg leading-relaxed text-gray-600 mb-3 italic"
              >
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
