'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { TestimonialsSection as TestimonialsSectionType } from '@/types/website.types';

interface TestimonialsSectionProps {
  config: Record<string, unknown>;
  websiteConfig: Record<string, unknown>;
  tenantSlug: string;
}

/**
 * Section 07 — Testimonials carousel.
 * Cream background, serif typography, ornamental divider, one card visible
 * at a time with fade animation, auto-rotates every 5 seconds. Max 3 testimonials.
 */
export function TestimonialsSection({ config }: TestimonialsSectionProps) {
  const sectionConfig = config as unknown as TestimonialsSectionType;

  const activeItems = (sectionConfig.items ?? [])
    .filter((t) => t.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, 3);

  const [current, setCurrent] = useState(0);
  const items = activeItems;

  const next = useCallback(() => {
    if (items.length <= 1) return;
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

  const subtitle = sectionConfig.subtitle || 'Real Experiences';

  // Parse title for italic accent: wrap *word* in <em>
  const renderTitle = (title: string) => {
    const parts = title.split('*');
    return parts.map((part, i) =>
      i % 2 === 1 ? (
        <em key={i}>{part}</em>
      ) : (
        <span key={i}>{part}</span>
      ),
    );
  };

  return (
    <section className="website-section">
      <div className="testimonial-section">
        <div className="max-w-[850px] mx-auto px-4 md:px-8">
          {/* Subtitle */}
          <p className="testimonial-subtitle">{subtitle}</p>

          {/* Main title */}
          <h2 className="testimonial-title">
            {renderTitle(sectionConfig.title || 'What Our *Community* Says')}
          </h2>

          {/* Ornamental divider */}
          <div className="testimonial-ornament">
            <span>◆</span>
          </div>

          {/* Testimonial cards */}
          <div className="testimonial-cards">
            {items.map((item, idx) => (
              <div
                key={item.id || idx}
                className={`testimonial-card${idx === current ? ' active' : ''}`}
              >
                <div className="quote-icon">&#8220;</div>

                <div className="stars">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i}>{i < item.rating ? '★' : '☆'}</span>
                  ))}
                </div>

                <p className="quote-text">&ldquo;{item.quote}&rdquo;</p>

                <div className="author-wrapper">
                  <span className="author-name">{item.customerName}</span>
                </div>

                {item.customerTitle && (
                  <p className="author-title">{item.customerTitle}</p>
                )}
              </div>
            ))}
          </div>

          {/* Pagination dots */}
          {items.length > 1 && (
            <div className="pagination-dots">
              {items.map((_, i) => (
                <button
                  key={i}
                  className={`dot${i === current ? ' active' : ''}`}
                  onClick={() => setCurrent(i)}
                  aria-label={`Testimonial ${i + 1}`}
                  type="button"
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .testimonial-section {
          background-color: #f9f5f0;
          padding: 80px 20px;
          text-align: center;
        }

        /* Subtitle */
        .testimonial-subtitle {
          font-size: 10px;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: #a68c78;
          font-weight: 600;
          margin-bottom: 12px;
          font-family: 'Montserrat', sans-serif;
        }

        /* Main title */
        .testimonial-title {
          font-family: 'Cormorant Garamond', 'Times New Roman', serif;
          font-size: 38px;
          font-weight: 400;
          color: #332d29;
          margin-bottom: 20px;
          line-height: 1.25;
        }

        .testimonial-title em {
          font-style: italic;
          color: #b08d6d;
        }

        /* Ornamental divider */
        .testimonial-ornament {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 15px;
          margin-bottom: 40px;
        }

        .testimonial-ornament::before,
        .testimonial-ornament::after {
          content: '';
          width: 60px;
          height: 1px;
          background-color: #e5d7cb;
        }

        .testimonial-ornament span {
          color: #b08d6d;
          font-size: 10px;
        }

        /* Cards wrapper */
        .testimonial-cards {
          margin-bottom: 25px;
          min-height: 250px;
          position: relative;
        }

        /* Individual card */
        .testimonial-card {
          display: none;
          background: #ffffff;
          padding: 50px 60px;
          border-radius: 2px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.03);
          max-width: 700px;
          margin: 0 auto;
          animation: fadeIn 0.4s ease-in-out;
        }

        .testimonial-card.active {
          display: block;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Quote icon */
        .quote-icon {
          font-family: 'Cormorant Garamond', 'Times New Roman', serif;
          font-size: 50px;
          line-height: 1;
          color: #ecdcd0;
          margin-bottom: 10px;
          user-select: none;
        }

        /* Stars */
        .stars {
          color: #b08d6d;
          font-size: 11px;
          letter-spacing: 4px;
          margin-bottom: 20px;
          user-select: none;
        }

        /* Quote text */
        .quote-text {
          font-family: 'Cormorant Garamond', 'Times New Roman', serif;
          font-style: italic;
          font-size: 19px;
          line-height: 1.7;
          color: #63574e;
          margin-bottom: 30px;
        }

        /* Author */
        .author-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 15px;
        }

        .author-wrapper::before,
        .author-wrapper::after {
          content: '';
          width: 25px;
          height: 1px;
          background-color: #d1c4b8;
        }

        .author-name {
          font-size: 11px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #332d29;
          font-weight: 500;
          font-family: 'Montserrat', sans-serif;
        }

        .author-title {
          font-size: 11px;
          color: #a68c78;
          margin-top: 4px;
          font-family: 'Montserrat', sans-serif;
        }

        /* Pagination dots */
        .pagination-dots {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 12px;
        }

        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: #d9cac0;
          cursor: pointer;
          transition: background-color 0.3s ease, transform 0.2s ease;
          border: none;
          outline: none;
          padding: 0;
        }

        .dot.active {
          background-color: #b08d6d;
          transform: scale(1.2);
        }

        /* Mobile responsive */
        @media (max-width: 600px) {
          .testimonial-section {
            padding: 50px 16px;
          }

          .testimonial-title {
            font-size: 28px;
          }

          .testimonial-card {
            padding: 35px 25px;
          }

          .quote-text {
            font-size: 16px;
          }
        }
      `}</style>
    </section>
  );
}
