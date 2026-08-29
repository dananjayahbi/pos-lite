'use client';

import React from 'react';
import type { InfoAdSection as InfoAdSectionConfig } from '@/types/website.types';
import { SectionAmbience } from '@/components/website/sections/SectionAmbience';

interface InfoAdSectionProps {
  config: Record<string, unknown>;
  websiteConfig: Record<string, unknown>;
  tenantSlug: string;
}

/**
 * Section 05 — SPOTLIGHT FEATURED BANNER.
 * Classic 2-column split: left = parallax image frame (36px radius),
 * right = title + subtitle + "BUY NOW" pill. Decorated with a halo + glow.
 */
export function InfoAdSection({ config }: InfoAdSectionProps) {
  const section = config as unknown as InfoAdSectionConfig;

  if (!section.isActive) return null;

  const image = section.desktopImageUrl;
  const title = section.title?.toUpperCase() || 'FEATURED ELIXIR';
  const subtitle = section.subtitle;

  return (
    <section id="spotlight-section" className="section-dark relative w-full py-20 sm:py-28 lg:py-36 overflow-hidden">
      <SectionAmbience
        leaves={[
          { icon: 'fa-solid fa-leaf', classes: 'top-16 right-10 text-6xl text-[#97c93e]', speed: 0.25 },
          { icon: 'fa-solid fa-seedling', classes: 'bottom-24 left-10 text-7xl text-emerald-400', speed: 0.32 },
          { icon: 'fa-solid fa-spa', classes: 'top-1/2 left-6 text-4xl text-lime-300', speed: 0.15 },
        ]}
        halos={['top-10 left-10']}
        glows={['bottom-10 right-10 w-96 h-96 bg-[#97c93e]/10']}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          {/* Left: image */}
          <div className="lg:col-span-6 reveal-on-scroll">
            <div className="relative mx-auto max-w-lg lg:max-w-none">
              <div className="spotlight-img-frame aspect-[4/5] sm:aspect-square lg:aspect-[4/5] w-full">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt={section.title} loading="lazy" className="spotlight-img" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 bg-[#082017]">
                    Image unavailable
                  </div>
                )}
                <div className="spotlight-img-vignette" />
              </div>
            </div>
          </div>

          {/* Right: content */}
          <div className="lg:col-span-6 flex flex-col justify-center reveal-on-scroll">
            <h2 className="spotlight-title mb-6">{title}</h2>
            {subtitle && <p className="spotlight-subtitle mb-8">{subtitle}</p>}
            <div>
              <a href="#shop" className="spotlight-buy-btn" aria-label={`Buy ${section.title}`}>
                <i className="fa-solid fa-bag-shopping text-sm" />
                <span>BUY NOW</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .spotlight-img-frame {
          position: relative;
          border-radius: 36px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow:
            0 25px 50px -15px rgba(0, 0, 0, 0.8),
            0 0 35px rgba(151, 201, 62, 0.08);
          transform-style: preserve-3d;
          transition:
            transform 500ms cubic-bezier(0.16, 1, 0.3, 1),
            box-shadow 500ms cubic-bezier(0.16, 1, 0.3, 1),
            border-color 400ms ease;
          will-change: transform;
        }
        .spotlight-img-frame:hover {
          border-color: rgba(151, 201, 62, 0.35);
          box-shadow:
            0 30px 60px -15px rgba(0, 0, 0, 0.9),
            0 0 45px rgba(151, 201, 62, 0.16);
        }
        .spotlight-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          transition: transform 800ms cubic-bezier(0.2, 1, 0.3, 1);
          will-change: transform;
        }
        .spotlight-img-frame:hover .spotlight-img {
          transform: scale(1.06);
        }
        .spotlight-img-vignette {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            180deg,
            rgba(0, 0, 0, 0.05) 0%,
            rgba(5, 22, 16, 0.5) 100%
          );
          pointer-events: none;
        }
        .spotlight-title {
          font-family: var(--font-serif);
          font-size: 2.25rem;
          line-height: 1.18;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: 0.02em;
        }
        @media (min-width: 640px) {
          .spotlight-title {
            font-size: 2.75rem;
          }
        }
        @media (min-width: 1024px) {
          .spotlight-title {
            font-size: 3.25rem;
          }
        }
        .spotlight-subtitle {
          font-size: 0.9375rem;
          line-height: 1.75;
          color: #cbd5e1;
          font-weight: 300;
        }
        .spotlight-buy-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 16px 36px;
          border-radius: 9999px;
          background: #97c93e;
          color: #000000;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 10px 25px rgba(151, 201, 62, 0.35);
          cursor: pointer;
        }
        .spotlight-buy-btn:hover {
          background: #b2db58;
          transform: translateY(-3px) scale(1.03);
          box-shadow: 0 14px 32px rgba(151, 201, 62, 0.5);
        }
        .spotlight-buy-btn:active {
          transform: translateY(0) scale(0.98);
        }
      `}</style>
    </section>
  );
}
