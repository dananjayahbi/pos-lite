'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CategoriesSection, PublicCategory } from '@/types/website.types';
import { SectionTitle } from '@/components/website/sections/SectionTitle';
import { SectionAmbience } from '@/components/website/sections/SectionAmbience';
import { ROUTES } from '@/config/site';

interface CategoryGridProps {
  config: Record<string, unknown>;
  websiteConfig: Record<string, unknown>;
  tenantSlug: string;
  categories?: PublicCategory[];
}

/**
 * Section 06 — "TOP CATEGORIES" kinetic expanding accordion deck.
 * Desktop: 7 vertical slices; hover/active expands one to `flex: 3.8`.
 * Mobile (≤1023px): a 2-col (then 1-col) bento grid with the expanded content
 * always visible.
 */
export function CategoryGrid({ config, tenantSlug, categories }: CategoryGridProps) {
  const section = config as unknown as CategoriesSection;
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);

  let source = categories ?? [];
  if (section.categoryIds && section.categoryIds.length > 0) {
    const idSet = new Set(section.categoryIds);
    source = source.filter((c) => idSet.has(c.id));
  }
  const display = source.slice(0, 7);

  if (display.length === 0) return null;

  const categoryImage = (cat: PublicCategory): string | undefined =>
    section.categoryImages?.[cat.id] ?? cat.imageUrl;

  const goToCategory = (cat: PublicCategory) => {
    router.push(ROUTES.category(tenantSlug, cat.id));
  };

  return (
    <section id="categories-section" className="section-dark relative w-full py-20 sm:py-28 lg:py-32 overflow-hidden">
      <SectionAmbience
        leaves={[
          { icon: 'fa-solid fa-leaf', classes: 'top-10 left-6 text-6xl text-[#97c93e]', speed: 0.2 },
          { icon: 'fa-solid fa-seedling', classes: 'bottom-16 right-10 text-7xl text-emerald-400', speed: 0.32 },
          { icon: 'fa-solid fa-spa', classes: 'top-1/2 right-1/4 text-5xl text-lime-300', speed: 0.14 },
        ]}
        glows={['-top-20 left-1/4 w-96 h-96 bg-[#97c93e]/10', 'bottom-0 right-1/3 w-80 h-80 bg-emerald-500/10']}
      />

      <SectionTitle label="CURATED AYURVEDIC LINEUP" title="TOP CATEGORIES" />

      <div className="reveal-on-scroll relative w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
        <div
          className="categories-accordion-deck"
          onMouseLeave={() => setActiveIndex(0)}
        >
          {display.map((cat, i) => {
            const active = i === activeIndex;
            const img = categoryImage(cat);
            return (
              <div
                key={cat.id}
                className={`category-slice group ${active ? 'active' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={cat.name}
                onMouseEnter={() => setActiveIndex(i)}
                onFocus={() => setActiveIndex(i)}
                onClick={() => {
                  setActiveIndex(i);
                  goToCategory(cat);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActiveIndex(i);
                    goToCategory(cat);
                  }
                }}
              >
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt={cat.name} loading="lazy" className="category-slice-img" />
                ) : (
                  <div className="absolute inset-0 bg-[#092218]" />
                )}
                <div className="category-slice-overlay" />

                {/* Collapsed (thin vertical) */}
                <div className="category-collapsed-content">
                  <span className="category-collapsed-number">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="category-collapsed-title">{cat.name}</span>
                  <div className="category-collapsed-icon">
                    <i className="fa-solid fa-leaf" />
                  </div>
                </div>

                {/* Expanded (cinematic showcase) */}
                <div className="category-expanded-content">
                  <span className="category-count-badge">
                    {cat.productCount ?? 0} Formulations
                  </span>
                  <div className="category-bottom-wrap">
                    <span className="category-expanded-title">{cat.name}</span>
                    <div className="category-title-bar" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        .categories-accordion-deck {
          display: flex;
          gap: 12px;
          height: 540px;
          width: 100%;
          border-radius: 36px;
          padding: 12px;
          background: rgba(8, 32, 23, 0.55);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.85);
          overflow: hidden;
          position: relative;
          z-index: 10;
        }
        .category-slice {
          position: relative;
          flex: 1;
          border-radius: 28px;
          overflow: hidden;
          cursor: pointer;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: #092218;
          transition:
            flex 650ms cubic-bezier(0.16, 1, 0.3, 1),
            box-shadow 500ms ease,
            border-color 400ms ease;
          min-width: 68px;
          will-change: flex, transform;
        }
        .category-slice.active,
        .category-slice:hover {
          flex: 3.8;
          border-color: rgba(151, 201, 62, 0.45);
          box-shadow:
            0 20px 45px -10px rgba(0, 0, 0, 0.85),
            0 0 30px rgba(151, 201, 62, 0.18);
        }
        .category-slice-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          transform: scale(1.04);
          filter: brightness(0.65) saturate(0.85);
          transition:
            transform 900ms cubic-bezier(0.2, 1, 0.3, 1),
            filter 600ms ease;
          will-change: transform, filter;
        }
        .category-slice.active .category-slice-img,
        .category-slice:hover .category-slice-img {
          transform: scale(1.1);
          filter: brightness(0.95) saturate(1.1);
        }
        .category-slice-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            180deg,
            rgba(0, 0, 0, 0.4) 0%,
            rgba(0, 0, 0, 0.1) 40%,
            rgba(5, 22, 16, 0.88) 85%,
            #051610 100%
          );
          pointer-events: none;
          z-index: 10;
          transition: opacity 400ms ease;
        }
        .category-collapsed-content {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          padding: 24px 8px;
          z-index: 20;
          opacity: 1;
          transition: opacity 300ms ease;
          pointer-events: none;
        }
        .category-slice.active .category-collapsed-content,
        .category-slice:hover .category-collapsed-content {
          opacity: 0;
          pointer-events: none;
        }
        .category-collapsed-number {
          font-size: 11px;
          font-weight: 700;
          color: #97c93e;
          font-family: var(--font-serif);
          letter-spacing: 0.1em;
        }
        .category-collapsed-title {
          writing-mode: vertical-rl;
          text-orientation: mixed;
          transform: rotate(180deg);
          font-family: var(--font-serif);
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.85);
          white-space: nowrap;
          margin: auto 0;
        }
        .category-collapsed-icon {
          width: 28px;
          height: 28px;
          border-radius: 9999px;
          background: rgba(0, 0, 0, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #97c93e;
          font-size: 10px;
        }
        .category-expanded-content {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 28px;
          z-index: 20;
          opacity: 0;
          pointer-events: none;
          transform: translateY(14px);
          transition:
            opacity 400ms cubic-bezier(0.16, 1, 0.3, 1) 120ms,
            transform 400ms cubic-bezier(0.16, 1, 0.3, 1) 120ms;
        }
        .category-slice.active .category-expanded-content,
        .category-slice:hover .category-expanded-content {
          opacity: 1;
          pointer-events: auto;
          transform: translateY(0);
        }
        .category-count-badge {
          align-self: flex-start;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.18);
          padding: 7px 16px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #97c93e;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.6);
          font-family: var(--font-sans);
        }
        .category-bottom-wrap {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }
        .category-expanded-title {
          font-family: var(--font-serif);
          font-size: 1.5rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #ffffff;
          line-height: 1.2;
        }
        @media (min-width: 1280px) {
          .category-expanded-title {
            font-size: 1.75rem;
          }
        }
        .category-title-bar {
          width: 32px;
          height: 2.5px;
          background: #97c93e;
          margin-top: 10px;
          border-radius: 9999px;
          box-shadow: 0 0 12px rgba(151, 201, 62, 0.6);
        }
        @media (max-width: 1023px) {
          .categories-accordion-deck {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
            height: auto;
            padding: 0;
            background: transparent;
            border: none;
            box-shadow: none;
          }
          .category-slice {
            flex: none;
            min-width: 0;
            aspect-ratio: 4 / 3;
            min-height: 220px;
            border-radius: 24px;
            border: 1px solid rgba(255, 255, 255, 0.08);
          }
          .category-slice:last-child {
            grid-column: span 2;
            aspect-ratio: 16 / 7;
          }
          .category-collapsed-content {
            display: none !important;
          }
          .category-expanded-content {
            opacity: 1 !important;
            pointer-events: auto !important;
            transform: translateY(0) !important;
            padding: 20px;
          }
          .category-expanded-title {
            font-size: 1.15rem;
          }
          .category-slice-img {
            filter: brightness(0.85) saturate(1) !important;
          }
        }
        @media (max-width: 639px) {
          .categories-accordion-deck {
            grid-template-columns: 1fr;
            gap: 14px;
          }
          .category-slice {
            aspect-ratio: 16 / 9;
          }
          .category-slice:last-child {
            grid-column: span 1;
            aspect-ratio: 16 / 9;
          }
          .category-expanded-title {
            font-size: 1.25rem;
          }
        }
      `}</style>
    </section>
  );
}
