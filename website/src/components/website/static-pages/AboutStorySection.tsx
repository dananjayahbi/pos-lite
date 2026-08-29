'use client';

import React from 'react';
import { useRevealOnScroll } from '@/hooks/useRevealOnScroll';

interface AboutStorySectionProps {
  title?: string;
  content?: string;
  imageUrl?: string;
  imagePosition?: 'left' | 'right';
}

/**
 * "Our Story" — split layout (reference: `#about-story`).
 * Left: 4:5 rounded image frame with subtle zoom on hover.
 * Right: serif title, dropcap + light paragraphs.
 */
export function AboutStorySection({
  title,
  content,
  imageUrl,
  imagePosition = 'left',
}: AboutStorySectionProps) {
  const textRef = useRevealOnScroll<HTMLDivElement>();
  const imgRef = useRevealOnScroll<HTMLDivElement>();

  if (!content && !imageUrl) return null;

  const paragraphs = (content ?? '')
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean);

  const textBlock = (
    <div ref={textRef}>
      {title && <h2 className="story-title">{title}</h2>}
      {paragraphs.length > 0 && (
        <div className="space-y-5 text-gray-300 font-light leading-relaxed">
          {paragraphs.map((paragraph, i) => (
            <p
              key={i}
              className={`story-text ${i === 0 ? 'story-dropcap' : ''}`}
            >
              {paragraph}
            </p>
          ))}
        </div>
      )}
    </div>
  );

  const imageBlock = imageUrl ? (
    <div ref={imgRef}>
      <div className="story-img-frame">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={title || 'About us'}
          className="story-img"
          loading="lazy"
        />
      </div>
    </div>
  ) : null;

  const isLeft = imagePosition === 'left';

  // When no image is configured, collapse to a single centred column so the
  // layout doesn't reserve an empty half-column for tenants without a story
  // image uploaded.
  if (!imageUrl) {
    return (
      <section className="relative w-full py-16 sm:py-24 lg:py-32 overflow-hidden bg-[#051610]">
        <div className="relative z-10 max-w-3xl mx-auto px-6 sm:px-10 lg:px-16">
          {textBlock}
        </div>
      </section>
    );
  }

  return (
    <section className="relative w-full py-16 sm:py-24 lg:py-32 overflow-hidden bg-[#051610]">
      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <div className={`lg:col-span-6 ${isLeft ? 'lg:order-1' : 'lg:order-2'}`}>
            {isLeft ? imageBlock : textBlock}
          </div>
          <div className={`lg:col-span-6 ${isLeft ? 'lg:order-2' : 'lg:order-1'}`}>
            {isLeft ? textBlock : imageBlock}
          </div>
        </div>
      </div>
    </section>
  );
}
