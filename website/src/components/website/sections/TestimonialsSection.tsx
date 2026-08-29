'use client';

import React from 'react';
import type { TestimonialsSection as TestimonialsSectionConfig, TestimonialItem } from '@/types/website.types';
import { SectionTitle } from '@/components/website/sections/SectionTitle';
import { SectionAmbience } from '@/components/website/sections/SectionAmbience';

interface TestimonialsSectionProps {
  config: Record<string, unknown>;
  websiteConfig: Record<string, unknown>;
  tenantSlug: string;
}

/** Build five star icons for a testimonial rating. */
function Stars({ rating }: { rating: number }) {
  return (
    <div className="testimonial-stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <i key={i} className={i < rating ? 'fa-solid fa-star' : 'fa-regular fa-star'} />
      ))}
    </div>
  );
}

function TestimonialCard({ item }: { item: TestimonialItem }) {
  return (
    <article className="testimonial-card">
      <Stars rating={item.rating || 5} />
      <p className="testimonial-quote">
        &ldquo;{item.quote}&rdquo;
      </p>
      <div className="testimonial-author-wrap">
        <span className="testimonial-name">{item.customerName}</span>
        {item.customerTitle && <span className="testimonial-title">{item.customerTitle}</span>}
      </div>
    </article>
  );
}

/**
 * Section 08 — "WHAT OUR PATRONS SAY" dual-stream kinetic marquee.
 * Two horizontally-scrolling rows moving in opposite directions, each card
 * duplicated 3× for a seamless infinite loop. Pauses on hover.
 */
export function TestimonialsSection({ config }: TestimonialsSectionProps) {
  const section = config as unknown as TestimonialsSectionConfig;

  const active = (section.items ?? [])
    .filter((t) => t.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (active.length === 0) return null;

  const title = section.title || 'What Our Patrons Say';
  const subtitle = section.subtitle;

  // Split into two groups & triple each for the infinite marquee.
  const half = Math.ceil(active.length / 2);
  const group1 = active.slice(0, half);
  const group2 = active.slice(half);
  const stream1 = [...group1, ...group1, ...group1];
  const stream2 = [...group2, ...group2, ...group2];

  return (
    <section id="testimonials-section" className="section-dark relative w-full py-20 sm:py-28 lg:py-36 overflow-hidden">
      <SectionAmbience
        leaves={[
          { icon: 'fa-solid fa-leaf', classes: 'top-14 right-12 text-6xl text-[#97c93e]', speed: 0.2 },
          { icon: 'fa-solid fa-seedling', classes: 'bottom-16 left-10 text-7xl text-emerald-400', speed: 0.28 },
          { icon: 'fa-solid fa-spa', classes: 'top-1/2 left-8 text-5xl text-lime-300', speed: 0.14 },
        ]}
        glows={['top-1/4 left-1/3 w-96 h-96 bg-[#97c93e]/10', 'bottom-0 right-1/4 w-80 h-80 bg-emerald-500/10']}
      />

      <SectionTitle
        label="VOICES OF HEALING"
        title={title}
        subtitle={
          subtitle ||
          'Discover how centuries-old Ceylon Ayurvedic wisdom has restored vitality, harmony, and timeless wellness to lives across the globe.'
        }
      />

      <div className="reveal-on-scroll relative w-full overflow-hidden">
        <div className="testimonials-river-container">
          <div className="testimonials-vignette-left" />
          <div className="testimonials-vignette-right" />
          <div className="testimonials-row-track stream-row-left">
            {stream1.map((item, i) => (
              <TestimonialCard key={`s1-${i}`} item={item} />
            ))}
          </div>
          <div className="testimonials-row-track stream-row-right">
            {stream2.map((item, i) => (
              <TestimonialCard key={`s2-${i}`} item={item} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
