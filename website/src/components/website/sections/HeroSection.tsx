'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { WebsiteConfigData, WebsiteHeroSlideData } from '@/types/website.types';

interface HeroSectionProps {
  config: Record<string, unknown>;
  websiteConfig: WebsiteConfigData;
  tenantSlug: string;
}

/**
 * Full-bleed hero slider with auto-advance, mouse-pause, and dot navigation.
 * Renders a graceful fallback when no slides are configured.
 */
export function HeroSection({ websiteConfig }: HeroSectionProps) {
  const slides = (websiteConfig.heroSlides ?? []) as WebsiteHeroSlideData[];
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const activeSlides = slides.filter((s) => s.isActive);
  const hasSlides = activeSlides.length > 0;

  const goToSlide = useCallback(
    (index: number) => {
      setCurrentSlide((index + activeSlides.length) % activeSlides.length);
    },
    [activeSlides.length],
  );

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % activeSlides.length);
  }, [activeSlides.length]);

  // Auto-play every 4s; pause on hover or when only one slide exists.
  useEffect(() => {
    if (!hasSlides || activeSlides.length <= 1 || isPaused) return;
    const timer = setInterval(nextSlide, 4000);
    return () => clearInterval(timer);
  }, [hasSlides, activeSlides.length, isPaused, nextSlide]);

  if (!hasSlides) {
    return (
      <section
        className="relative bg-[#ece2d6] flex items-center justify-center"
        style={{ minHeight: '60vh' }}
      >
        <div className="text-center px-4">
          <h1
            className="text-3xl md:text-5xl lg:text-6xl mb-4"
            style={{ fontFamily: 'var(--font-dm-serif), serif' }}
          >
            {websiteConfig.siteName || 'Premium Ayurveda'}
          </h1>
          {websiteConfig.tagline && (
            <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto">
              {websiteConfig.tagline}
            </p>
          )}
        </div>
      </section>
    );
  }

  const slide = activeSlides[currentSlide];
  if (!slide) return null;

  const isVideo = slide.mediaType === 'video';

  return (
    <section
      className="hero-slide relative"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Desktop media */}
      <div className="hidden md:block">
        {isVideo ? (
          <video
            className="hero-slide-video"
            src={slide.mediaUrl}
            autoPlay
            muted
            loop
            playsInline
            style={{ maxHeight: '85vh' }}
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
      </div>

      {/* Mobile media */}
      <div className="block md:hidden">
        {isVideo ? (
          <video
            className="hero-slide-video"
            src={slide.mobileMediaUrl || slide.mediaUrl}
            autoPlay
            muted
            loop
            playsInline
            style={{ maxHeight: '60vh' }}
          />
        ) : (
          <div
            className="hero-slide-image"
            style={{
              backgroundImage: `url(${slide.mobileMediaUrl || slide.mediaUrl})`,
              paddingTop: '100%',
              maxHeight: '60vh',
            }}
          />
        )}
      </div>

      {/* Text overlay */}
      {(slide.title || slide.subtitle || slide.description) && (
        <div className="hero-slide-overlay">
          <div className="max-w-2xl mx-auto">
            {slide.subtitle && (
              <p
                className="text-xs md:text-sm uppercase tracking-[0.25em] mb-3 text-white/80"
                style={{ fontFamily: 'var(--font-jost), sans-serif' }}
              >
                {slide.subtitle}
              </p>
            )}
            {slide.title && (
              <h2
                className="text-2xl md:text-4xl lg:text-5xl mb-4 leading-tight"
                style={{ fontFamily: 'var(--font-dm-serif), serif' }}
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
                className="inline-block px-8 py-3 border-2 border-white text-white uppercase text-xs tracking-wider hover:bg-white hover:text-black transition-colors"
              >
                {slide.ctaText}
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Navigation dots */}
      {activeSlides.length > 1 && (
        <div className="flickity-dots absolute bottom-4 left-0 right-0">
          {activeSlides.map((_, i) => (
            <button
              key={i}
              className={`flickity-dot${i === currentSlide ? ' active' : ''}`}
              onClick={() => goToSlide(i)}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}