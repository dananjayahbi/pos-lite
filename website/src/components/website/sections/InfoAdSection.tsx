'use client';

import React from 'react';
import Link from 'next/link';
import type { InfoAdSection as InfoAdSectionConfig } from '@/types/website.types';

interface InfoAdSectionProps {
  config: Record<string, unknown>;
  websiteConfig: Record<string, unknown>;
  tenantSlug: string;
}

/**
 * Section 04 — Two-column info/advertisement block.
 * - 100% width, max-height 950px (taller on mobile)
 * - Desktop: LEFT = image, RIGHT = title + subtitle + optional button
 * - Mobile: image on top, text on bottom
 * - Right-side content centered vertically & horizontally
 * - Button styled with site accent color
 * - 8px gap below via mb-[8px]
 */
export function InfoAdSection({ config }: InfoAdSectionProps) {
  const section = config as unknown as InfoAdSectionConfig;

  if (!section.isActive) return null;

  const headingFont = 'var(--site-heading-font), serif';
  const bodyFont = 'var(--site-body-font), sans-serif';

  const mobileImage = section.mobileImageUrl || section.desktopImageUrl;

  return (
    <section className="info-ad-section mb-[8px]">
      {/* Desktop layout: side-by-side */}
      <div className="info-ad-desktop">
        {/* Left: Image */}
        <div className="info-ad-image-col">
          <div
            className="info-ad-image"
            style={{ backgroundImage: `url(${section.desktopImageUrl})` }}
            role="img"
            aria-label={section.title}
          />
        </div>

        {/* Right: Text content */}
        <div className="info-ad-text-col">
          <div className="info-ad-text-inner">
            <h2 className="info-ad-title">{section.title}</h2>
            <p className="info-ad-subtitle">{section.subtitle}</p>
            {section.buttonText && section.buttonLink && (
              <Link href={section.buttonLink} className="info-ad-button">
                {section.buttonText}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Mobile layout: stacked */}
      <div className="info-ad-mobile">
        <div
          className="info-ad-mobile-image"
          style={{ backgroundImage: `url(${mobileImage})` }}
          role="img"
          aria-label={section.title}
        />
        <div className="info-ad-mobile-text">
          <h2 className="info-ad-title">{section.title}</h2>
          <p className="info-ad-subtitle">{section.subtitle}</p>
          {section.buttonText && section.buttonLink && (
            <Link href={section.buttonLink} className="info-ad-button">
              {section.buttonText}
            </Link>
          )}
        </div>
      </div>

      <style jsx>{`
        .info-ad-section {
          width: 100%;
          overflow: hidden;
        }

        /* Desktop: 2-column grid */
        .info-ad-desktop {
          display: grid;
          grid-template-columns: 1fr 1fr;
          max-height: 950px;
        }

        .info-ad-image-col {
          overflow: hidden;
        }

        .info-ad-image {
          width: 100%;
          height: 100%;
          min-height: 500px;
          max-height: 950px;
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
        }

        .info-ad-text-col {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 3rem;
          background: var(--site-bg-color, #ffffff);
        }

        .info-ad-text-inner {
          text-align: center;
          max-width: 480px;
        }

        /* Mobile: stacked (hidden on desktop) */
        .info-ad-mobile {
          display: none;
        }

        .info-ad-mobile-image {
          width: 100%;
          height: 50vh;
          max-height: 450px;
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
        }

        .info-ad-mobile-text {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 2rem 1.5rem;
          background: var(--site-bg-color, #ffffff);
        }

        /* Shared text styles */
        .info-ad-title {
          font-family: ${headingFont};
          font-size: clamp(1.5rem, 4vw, 2.5rem);
          color: var(--site-heading-color, #333);
          line-height: 1.15;
          margin-bottom: 1rem;
        }

        .info-ad-subtitle {
          font-family: ${bodyFont};
          font-size: clamp(0.9375rem, 2vw, 1.125rem);
          color: var(--site-body-color, #555);
          line-height: 1.7;
          margin-bottom: 1.75rem;
        }

        .info-ad-button {
          display: inline-block;
          padding: 0.75rem 2rem;
          background: var(--site-accent, #8b5e3c);
          color: #fff;
          font-family: ${bodyFont};
          font-size: 0.9375rem;
          font-weight: 500;
          border-radius: 4px;
          text-decoration: none;
          transition: opacity 0.2s ease, transform 0.15s ease;
        }
        .info-ad-button:hover {
          opacity: 0.9;
          transform: translateY(-1px);
        }

        /* Responsive breakpoint */
        @media (max-width: 767px) {
          .info-ad-desktop {
            display: none;
          }
          .info-ad-mobile {
            display: block;
          }
        }
      `}</style>
    </section>
  );
}
