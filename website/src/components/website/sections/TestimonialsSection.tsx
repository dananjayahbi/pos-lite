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

      <style jsx>{`
        .testimonials-river-container {
          position: relative;
          width: 100%;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          gap: 24px;
          padding: 10px 0;
        }
        .testimonials-row-track {
          display: flex;
          gap: 24px;
          width: max-content;
          will-change: transform;
        }
        .stream-row-left {
          animation: marqueeStreamLeft 44s linear infinite;
        }
        .stream-row-right {
          animation: marqueeStreamRight 48s linear infinite;
        }
        .testimonials-river-container:hover .stream-row-left,
        .testimonials-river-container:hover .stream-row-right {
          animation-play-state: paused;
        }
        @keyframes marqueeStreamLeft {
          0% {
            transform: translate3d(0, 0, 0);
          }
          100% {
            transform: translate3d(-50%, 0, 0);
          }
        }
        @keyframes marqueeStreamRight {
          0% {
            transform: translate3d(-50%, 0, 0);
          }
          100% {
            transform: translate3d(0, 0, 0);
          }
        }
        .testimonials-vignette-left {
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 60px;
          z-index: 25;
          background: linear-gradient(
            to right,
            #051610 0%,
            rgba(5, 22, 16, 0.8) 40%,
            transparent 100%
          );
          pointer-events: none;
        }
        .testimonials-vignette-right {
          position: absolute;
          right: 0;
          top: 0;
          bottom: 0;
          width: 60px;
          z-index: 25;
          background: linear-gradient(
            to left,
            #051610 0%,
            rgba(5, 22, 16, 0.8) 40%,
            transparent 100%
          );
          pointer-events: none;
        }
        @media (min-width: 640px) {
          .testimonials-vignette-left,
          .testimonials-vignette-right {
            width: 120px;
          }
        }
        @media (min-width: 1024px) {
          .testimonials-vignette-left,
          .testimonials-vignette-right {
            width: 180px;
          }
        }

        .testimonial-card {
          width: 310px;
          background: rgba(8, 32, 23, 0.72);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 28px;
          padding: 24px;
          box-shadow: 0 15px 35px -5px rgba(0, 0, 0, 0.6);
          transform-style: preserve-3d;
          transition:
            transform 400ms cubic-bezier(0.16, 1, 0.3, 1),
            box-shadow 400ms cubic-bezier(0.16, 1, 0.3, 1),
            border-color 350ms ease;
          flex-shrink: 0;
        }
        @media (min-width: 640px) {
          .testimonial-card {
            width: 360px;
          }
        }
        @media (min-width: 1024px) {
          .testimonial-card {
            width: 390px;
          }
        }
        .testimonial-card:hover {
          transform: translateY(-8px) scale(1.02);
          border-color: rgba(151, 201, 62, 0.45);
          box-shadow:
            0 25px 50px -10px rgba(0, 0, 0, 0.85),
            0 0 30px rgba(151, 201, 62, 0.16);
        }
        .testimonial-stars {
          color: #97c93e;
          font-size: 13px;
          gap: 4px;
          margin-bottom: 14px;
          display: flex;
        }
        .testimonial-quote {
          font-size: 0.875rem;
          line-height: 1.68;
          font-style: italic;
          font-weight: 300;
          color: #e2e8f0;
          margin-bottom: 20px;
          font-family: var(--font-sans);
        }
        @media (min-width: 640px) {
          .testimonial-quote {
            font-size: 0.9375rem;
          }
        }
        .testimonial-author-wrap {
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          padding-top: 14px;
          display: flex;
          flex-direction: column;
        }
        .testimonial-name {
          font-size: 0.9375rem;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: 0.04em;
        }
        @media (min-width: 640px) {
          .testimonial-name {
            font-size: 1rem;
          }
        }
        .testimonial-title {
          font-size: 0.6875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #97c93e;
        }
        @media (min-width: 640px) {
          .testimonial-title {
            font-size: 0.75rem;
          }
        }
      `}</style>
    </section>
  );
}
