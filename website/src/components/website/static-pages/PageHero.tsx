'use client';

import React from 'react';
import { useParallaxEngine } from '@/hooks/useParallaxEngine';
import { useRevealOnScroll } from '@/hooks/useRevealOnScroll';

/**
 * Shared parallax hero for CMS static pages (About, Contact).
 *
 * Mirrors the reference design's `#about-hero` section: a full-bleed
 * background image (with scroll parallax + radial vignette) framing a centered
 * Cinzel title, optional subtitle and optional description.
 *
 * The parallax background is animated by the global `useParallaxEngine()` via
 * the `#page-hero-bg-container` id. This component mounts its own engine so
 * the effect works even on pages that don't render WebsiteShell.
 */
interface PageHeroProps {
  title: string;
  subtitle?: string;
  description?: string;
  heroImageUrl?: string;
}

export function PageHero({
  title,
  subtitle,
  description,
  heroImageUrl,
}: PageHeroProps) {
  useParallaxEngine();
  const contentRef = useRevealOnScroll<HTMLDivElement>();

  return (
    <section
      className="relative pt-[112px] border-b border-white/5 overflow-hidden"
      style={
        heroImageUrl
          ? {
              backgroundImage: `url(${heroImageUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center 35%',
              minHeight: '480px',
            }
          : { backgroundColor: 'rgba(5, 22, 16, 0.95)', minHeight: '480px' }
      }
    >
      {/* Parallax background layer (animated by useParallaxEngine) */}
      {heroImageUrl && (
        <div
          id="page-hero-bg-container"
          className="about-hero-bg"
          style={{ backgroundImage: `url(${heroImageUrl})` }}
        />
      )}
      {/* Readability vignette */}
      <div className="about-hero-vignette" />

      <div
        ref={contentRef}
        className="relative z-10 max-w-5xl mx-auto px-6 py-16 md:py-24 text-center"
      >
        <h1
          className="about-hero-title"
          style={{ fontFamily: 'var(--font-serif), serif' }}
        >
          {title}
        </h1>
        {subtitle && <p className="about-hero-subtitle">{subtitle}</p>}
        {description && (
          <p className="mt-2 text-sm text-[#94a3b8] max-w-xl mx-auto">{description}</p>
        )}
        <div className="w-16 h-[2px] bg-[#97c93e]/60 mx-auto mt-6 rounded-full" />
      </div>
    </section>
  );
}
