'use client';

import React from 'react';
import Link from 'next/link';
import type { WebsiteConfigData, WebsiteHeroSlideData } from '@/types/website.types';

interface HeroSectionProps {
  config: Record<string, unknown>;
  websiteConfig: WebsiteConfigData;
  tenantSlug: string;
}

/**
 * Section 01 — Full-width hero banner.
 * - 100% width, max-height 600px (responsive)
 * - Video or image background from first active heroSlide
 * - Dark gradient overlay for text readability
 * - Centered text overlay: Title (serif heading) + Subtitle (body)
 * - Fallback gradient background when no active slide exists
 * - 8px gap below via mb-[8px]
 */
export function HeroSection({ websiteConfig }: HeroSectionProps) {
  const slides = (websiteConfig.heroSlides ?? []) as WebsiteHeroSlideData[];
  const slide = slides.find((s) => s.isActive) ?? null;

  const headingFont = 'var(--site-heading-font), serif';
  const bodyFont = 'var(--site-body-font), sans-serif';

  // ── Fallback: no active slide ────────────────────────────────────────────
  if (!slide) {
    return (
      <section className="hero-fallback mb-[8px]">
        <div className="hero-fallback-bg" />
        <div className="hero-fallback-content">
          <h1 className="hero-fallback-title">
            {websiteConfig.siteName || 'Welcome'}
          </h1>
          {websiteConfig.tagline && (
            <p className="hero-fallback-subtitle">{websiteConfig.tagline}</p>
          )}
          <div className="hero-fallback-divider" />
        </div>
        <style jsx>{`
          .hero-fallback {
            position: relative;
            width: 100%;
            min-height: 60vh;
            max-height: 600px;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
          }
          .hero-fallback-bg {
            position: absolute;
            inset: 0;
            background: linear-gradient(
              135deg,
              #f9f5f0 0%,
              #f0ebe3 30%,
              #e8dfd5 70%,
              #ddd4c5 100%
            );
          }
          .hero-fallback-bg::after {
            content: '';
            position: absolute;
            inset: 0;
            opacity: 0.04;
            background-image: radial-gradient(
                circle at 20% 30%,
                var(--site-accent, #8b5e3c) 1px,
                transparent 1px
              ),
              radial-gradient(
                circle at 80% 70%,
                var(--site-accent, #8b5e3c) 1px,
                transparent 1px
              );
            background-size: 60px 60px;
          }
          .hero-fallback-content {
            position: relative;
            z-index: 10;
            text-align: center;
            padding: 2rem;
          }
          .hero-fallback-title {
            font-family: ${headingFont};
            font-size: clamp(2rem, 5vw, 3.5rem);
            color: var(--site-dark-brown, #3e2723);
            margin-bottom: 1rem;
            line-height: 1.15;
          }
          .hero-fallback-subtitle {
            font-family: ${bodyFont};
            font-size: clamp(1rem, 2.5vw, 1.25rem);
            color: var(--site-body-color, #5d4037);
            max-width: 600px;
            margin: 0 auto;
            line-height: 1.6;
          }
          .hero-fallback-divider {
            width: 80px;
            height: 2px;
            background: var(--site-accent, #8b5e3c);
            margin: 1.5rem auto 0;
            opacity: 0.5;
          }
          @media (max-width: 768px) {
            .hero-fallback {
              min-height: 50vh;
              max-height: 400px;
            }
          }
          @media (max-width: 480px) {
            .hero-fallback {
              min-height: 40vh;
              max-height: 320px;
            }
          }
        `}</style>
      </section>
    );
  }

  // ── Active slide ─────────────────────────────────────────────────────────
  const isVideo = slide.mediaType === 'video';
  const desktopMedia = slide.mediaUrl;
  const mobileMedia = slide.mobileMediaUrl || desktopMedia;

  return (
    <section className="hero-section mb-[8px]">
      {/* Desktop background */}
      <div className="hero-bg-desktop">
        {isVideo ? (
          <video
            src={desktopMedia}
            autoPlay
            muted
            loop
            playsInline
            className="hero-media"
          />
        ) : (
          <div
            className="hero-media hero-bg-image"
            style={{ backgroundImage: `url(${desktopMedia})` }}
          />
        )}
        <div className="hero-overlay" />
      </div>

      {/* Mobile background */}
      <div className="hero-bg-mobile">
        {isVideo ? (
          <video
            src={mobileMedia}
            autoPlay
            muted
            loop
            playsInline
            className="hero-media"
          />
        ) : (
          <div
            className="hero-media hero-bg-image"
            style={{ backgroundImage: `url(${mobileMedia})` }}
          />
        )}
        <div className="hero-overlay" />
      </div>

      {/* Text overlay */}
      {(slide.title || slide.subtitle || slide.description || slide.ctaText) && (
        <div className="hero-text-overlay">
          {slide.subtitle && (
            <p className="hero-subtitle">{slide.subtitle}</p>
          )}
          {slide.title && <h1 className="hero-title">{slide.title}</h1>}
          {slide.description && (
            <p className="hero-description">{slide.description}</p>
          )}
          {slide.ctaText && slide.ctaLink && (
            <Link href={slide.ctaLink} className="hero-cta">
              {slide.ctaText}
            </Link>
          )}
        </div>
      )}

      <style jsx>{`
        .hero-section {
          position: relative;
          width: 100%;
          max-height: 600px;
          overflow: hidden;
        }

        /* Background containers */
        .hero-bg-desktop {
          display: none;
          position: relative;
        }
        .hero-bg-mobile {
          display: block;
          position: relative;
        }

        .hero-media {
          width: 100%;
          max-height: 600px;
          object-fit: cover;
          display: block;
        }

        .hero-bg-image {
          height: 60vh;
          max-height: 600px;
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
        }

        /* Dark gradient overlay */
        .hero-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to top,
            rgba(0, 0, 0, 0.65) 0%,
            rgba(0, 0, 0, 0.25) 40%,
            rgba(0, 0, 0, 0.05) 100%
          );
          pointer-events: none;
        }

        /* Text overlay — centered vertically & horizontally */
        .hero-text-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 2rem;
          z-index: 2;
        }

        .hero-subtitle {
          font-family: ${bodyFont};
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.25em;
          color: rgba(255, 255, 255, 0.85);
          margin-bottom: 0.75rem;
        }

        .hero-title {
          font-family: ${headingFont};
          font-size: clamp(1.75rem, 5vw, 3.5rem);
          color: #ffffff;
          line-height: 1.12;
          margin-bottom: 1rem;
          max-width: 800px;
          text-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
        }

        .hero-description {
          font-family: ${bodyFont};
          font-size: clamp(0.875rem, 2vw, 1.125rem);
          color: rgba(255, 255, 255, 0.9);
          max-width: 560px;
          line-height: 1.6;
          margin-bottom: 1.5rem;
        }

        .hero-cta {
          display: inline-block;
          padding: 0.75rem 2rem;
          background: var(--site-accent, #8b5e3c);
          color: #fff;
          font-family: ${bodyFont};
          font-size: 0.9375rem;
          font-weight: 500;
          border-radius: 4px;
          text-decoration: none;
          transition: opacity 0.2s ease;
        }
        .hero-cta:hover {
          opacity: 0.9;
        }

        /* Responsive */
        @media (min-width: 768px) {
          .hero-bg-desktop {
            display: block;
          }
          .hero-bg-mobile {
            display: none;
          }
          .hero-bg-image {
            height: 600px;
          }
        }

        @media (max-width: 767px) {
          .hero-section {
            max-height: 400px;
          }
          .hero-media {
            max-height: 70vh;
          }
          .hero-bg-image {
            height: 60vh;
            max-height: 400px;
          }
          .hero-text-overlay {
            padding: 1.25rem;
          }
        }

        @media (max-width: 480px) {
          .hero-section {
            max-height: 320px;
          }
          .hero-bg-image {
            height: 55vh;
            max-height: 320px;
          }
        }
      `}</style>
    </section>
  );
}
