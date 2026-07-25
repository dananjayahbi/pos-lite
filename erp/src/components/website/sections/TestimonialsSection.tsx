'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Star } from 'lucide-react';
import type { TestimonialsSection as TestimonialsSectionType } from '@/types/website.types';

interface TestimonialsSectionProps {
  config: Record<string, unknown>;
  websiteConfig: Record<string, unknown>;
  tenantSlug: string;
}

export function TestimonialsSection({ config }: TestimonialsSectionProps) {
  const sectionConfig = config as unknown as TestimonialsSectionType;
  const items = (sectionConfig.items ?? []).filter((t) => t.isActive);
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % items.length);
  }, [items.length]);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [items.length, next]);

  if (items.length === 0) return null;

  const testimonial = items[current];
  if (!testimonial) return null;

  return (
    <section
      className="py-16 md:py-20 relative overflow-hidden"
      style={{ backgroundColor: 'var(--site-testimonial-bg)' }}
    >
      {/* Decorative circles */}
      <div
        className="absolute -top-20 -left-20 w-80 h-80 rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, rgba(180,148,110,0.3), transparent)' }}
      />
      <div
        className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, rgba(180,148,110,0.3), transparent)' }}
      />

      <div className="max-w-4xl mx-auto px-4 relative z-10">
        {/* Header */}
        <div className="text-center mb-10">
          <p
            className="text-xs uppercase tracking-[0.25em] mb-3"
            style={{ fontFamily: 'var(--font-jost), sans-serif', color: 'var(--site-accent)' }}
          >
            {sectionConfig.title || 'Testimonials'}
          </p>
          {sectionConfig.subtitle && (
            <h3
              className="text-2xl md:text-4xl font-light mb-4"
              style={{
                fontFamily: 'var(--font-cormorant), serif',
                color: 'var(--site-dark-brown)',
              }}
            >
              {sectionConfig.subtitle.split('*').map((part, i) =>
                i % 2 === 1 ? (
                  <em key={i} style={{ color: 'var(--site-accent)' }}>
                    {part}
                  </em>
                ) : (
                  <span key={i}>{part}</span>
                )
              )}
            </h3>
          )}

          {/* Divider */}
          <div className="flex items-center justify-center gap-3">
            <div className="w-12 h-px bg-gradient-to-r from-transparent to-[#b4946e]" />
            <span style={{ color: 'var(--site-accent)' }}>✦</span>
            <div className="w-12 h-px bg-gradient-to-l from-transparent to-[#b4946e]" />
          </div>
        </div>

        {/* Testimonial Card */}
        <div className="testimonial-card">
          <div className="testimonial-quote-mark">&#8220;</div>

          <div className="testimonial-stars">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={16}
                fill={i < testimonial.rating ? 'currentColor' : 'none'}
                className="inline-block"
              />
            ))}
          </div>

          <blockquote
            className="text-base md:text-lg italic leading-relaxed mb-6 px-4"
            style={{ fontFamily: 'var(--font-cormorant), serif', color: 'var(--site-dark-brown)' }}
          >
            &ldquo;{testimonial.quote}&rdquo;
          </blockquote>

          <div
            className="text-xs uppercase tracking-[0.2em]"
            style={{ fontFamily: 'var(--font-jost), sans-serif', color: 'var(--site-accent)' }}
          >
            <span className="inline-block w-6 h-px align-middle mr-2" style={{ backgroundColor: 'var(--site-accent)' }} />
            {testimonial.customerName}
            <span className="inline-block w-6 h-px align-middle ml-2" style={{ backgroundColor: 'var(--site-accent)' }} />
          </div>
          {testimonial.customerTitle && (
            <p className="text-xs text-gray-500 mt-1" style={{ fontFamily: 'var(--font-jost), sans-serif' }}>
              {testimonial.customerTitle}
            </p>
          )}
        </div>

        {/* Dots */}
        {items.length > 1 && (
          <div className="testimonial-dots">
            {items.map((_, i) => (
              <button
                key={i}
                className={`testimonial-dot${i === current ? ' active' : ''}`}
                onClick={() => setCurrent(i)}
                aria-label={`Testimonial ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
