'use client';

import React from 'react';

interface AboutStorySectionProps {
  title?: string;
  content?: string;
  imageUrl?: string;
  imagePosition?: 'left' | 'right';
}

export function AboutStorySection({
  title,
  content,
  imageUrl,
  imagePosition = 'right',
}: AboutStorySectionProps) {
  if (!content && !imageUrl) return null;

  return (
    <section className="py-12 md:py-16">
      <div
        className={`grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center ${
          imagePosition === 'left' ? 'md:[direction:rtl]' : ''
        }`}
      >
        {/* Text */}
        <div className={imagePosition === 'left' ? 'md:[direction:ltr]' : ''}>
          {title && (
            <h2
              className="text-2xl md:text-3xl font-medium mb-4 text-[var(--site-primary,#0a0a0a)]"
              style={{ fontFamily: 'var(--font-dm-serif), serif' }}
            >
              {title}
            </h2>
          )}
          {content && (
            <div className="prose prose-gray max-w-none">
              {content.split('\n').map((paragraph, i) => (
                <p
                  key={i}
                  className="text-sm md:text-base leading-relaxed text-gray-600 mb-3"
                >
                  {paragraph}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Image */}
        {imageUrl && (
          <div className={imagePosition === 'left' ? 'md:[direction:ltr]' : ''}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={title || 'About us'}
              className="w-full h-auto rounded-lg object-cover aspect-[4/3] shadow-md"
            />
          </div>
        )}
      </div>
    </section>
  );
}
