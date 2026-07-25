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
 * Full-bleed hero banner with a single image or video.
 * Uses only the first active hero slide (no slider/carousel behavior).
 * Renders a graceful fallback when no slide is configured.
 */
export function HeroSection({ websiteConfig }: HeroSectionProps) {
  const slides = (websiteConfig.heroSlides ?? []) as WebsiteHeroSlideData[];

  // Take only the first active slide — single image/video, not a slider
  const slide = slides.find((s) => s.isActive) ?? null;

  if (!slide) {
    return (
      <section
        className="relative bg-gradient-to-br from-[#f9f5f0] via-[#f0ebe3] to-[#e8dfd5] flex items-center justify-center overflow-hidden"
        style={{ minHeight: '80vh' }}
      >
        {/* Decorative subtle pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(circle at 25% 30%, var(--site-accent) 1px, transparent 1px),
              radial-gradient(circle at 75% 70%, var(--site-accent) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
        <div className="text-center px-4 relative z-10">
          <h1
            className="text-4xl md:text-5xl lg:text-6xl mb-6 text-[var(--site-dark-brown)] leading-tight"
            style={{ fontFamily: 'var(--site-heading-font), serif' }}
          >
            {websiteConfig.siteName || 'Welcome'}
          </h1>
          {websiteConfig.tagline && (
            <p className="text-lg md:text-xl text-[var(--site-body-color)] max-w-2xl mx-auto leading-relaxed">
              {websiteConfig.tagline}
            </p>
          )}
          <div className="mt-10 w-20 h-[2px] bg-[var(--site-accent)] mx-auto opacity-60" />
        </div>
      </section>
    );
  }

  const isVideo = slide.mediaType === 'video';

  return (
    <section className="hero-slide relative">
      {/* Desktop media */}
      <div className="hidden md:block relative">
        {isVideo ? (
          <video
            className="hero-slide-video"
            src={slide.mediaUrl}
            autoPlay
            muted
            loop
            playsInline
            style={{ maxHeight: '85vh', width: '100%' }}
          />
        ) : (
          <div
            className="hero-slide-image"
            style={{
              backgroundImage: `url(${slide.mediaUrl})`,
              paddingTop: '56.25%',
              maxHeight: '85vh',
            }}
          />
        )}
        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-black/10 pointer-events-none" />
      </div>

      {/* Mobile media */}
      <div className="block md:hidden relative">
        {isVideo ? (
          <video
            className="hero-slide-video"
            src={slide.mobileMediaUrl || slide.mediaUrl}
            autoPlay
            muted
            loop
            playsInline
            style={{ maxHeight: '70vh', width: '100%' }}
          />
        ) : (
          <div
            className="hero-slide-image"
            style={{
              backgroundImage: `url(${slide.mobileMediaUrl || slide.mediaUrl})`,
              paddingTop: '100%',
              maxHeight: '70vh',
            }}
          />
        )}
        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-black/10 pointer-events-none" />
      </div>

      {/* Text overlay */}
      {(slide.title || slide.subtitle || slide.description) && (
        <div className="hero-slide-overlay">
          <div className="max-w-2xl mx-auto">
            {slide.subtitle && (
              <p
                className="text-xs md:text-sm uppercase tracking-[0.25em] mb-3 text-white/80"
                style={{ fontFamily: 'var(--site-body-font), sans-serif' }}
              >
                {slide.subtitle}
              </p>
            )}
            {slide.title && (
              <h2
                className="text-2xl md:text-4xl lg:text-5xl mb-4 leading-tight"
                style={{ fontFamily: 'var(--site-heading-font), serif' }}
              >
                {slide.title}
              </h2>
            )}
            {slide.description && (
              <p className="text-sm md:text-base text-white/80 mb-6 max-w-lg mx-auto">
                {slide.description}
              </p>
            )}
            {slide.ctaText && slide.ctaLink && (
              <Link
                href={slide.ctaLink}
                className="cta-button"
              >
                {slide.ctaText}
              </Link>
            )}
          </div>
        </div>
      )}
    </section>
  );
}