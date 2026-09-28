'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import type {
  WebsiteConfigData,
  WebsiteHeroSlideData,
  WebsiteHeroSection,
  WebsiteHeroSocialLinks,
} from '@/types/website.types';
import { ROUTES } from '@/config/site';

interface HeroSectionProps {
  config: Record<string, unknown>;
  websiteConfig: WebsiteConfigData;
  tenantSlug: string;
}

/** Splits a title into two stacked lines for the big Cinzel lock-up. */
function splitTitle(title?: string): { main: string; sub: string } {
  if (!title) return { main: 'PROTECT', sub: 'NATURE' };
  const words = title.trim().split(/\s+/);
  if (words.length === 1) return { main: words[0] ?? 'PROTECT', sub: 'NATURE' };
  const mid = Math.ceil(words.length / 2);
  return {
    main: words.slice(0, mid).join(' ') || 'PROTECT',
    sub: words.slice(mid).join(' ') || 'NATURE',
  };
}
/**
 * Section 01 — FULL-SCREEN crossfading hero slider.
 *
 *   - stacked `.hero-bg-slide` layers crossfade with a Ken-Burns settle
 *   - radial `.hero-vignette` for readability
 *   - left column: big Cinzel split title + tagline + brand line
 *   - right column: heading, description, CTA buttons
 *   - bottom: pagination dots (center)
 *   - right vertical social dock (desktop only)
 * Common editorial controls (Consult Doctor button, "Crafted by" line, social
 * links) come from `websiteConfig.sections.hero` — shared across all slides.
 * Autoplays every 6.5s, pauses on hover, supports dot clicks, keyboard + swipe.
 */
export function HeroSection({ websiteConfig, tenantSlug }: HeroSectionProps) {
  const slides = (websiteConfig.heroSlides ?? []).filter((s) => s.isActive);
  const effectiveSlides = slides.length > 0 ? slides : fallbackSlides(websiteConfig, tenantSlug);

  const [current, setCurrent] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [exiting, setExiting] = useState(false);
  const touchX = useRef<number | null>(null);

  const total = effectiveSlides.length;
  const slide = effectiveSlides[current] ?? effectiveSlides[0];
  const split = splitTitle(slide?.title);

  // Common hero editorial settings (shared across all slides).
  const heroSettings = (websiteConfig.sections?.hero ??
    {}) as Partial<WebsiteHeroSection>;

  // Resolve the "Crafted by" line: explicit text, else fall back to the brand.
  const craftedByText =
    heroSettings.craftedByText ||
    `Crafted by ${websiteConfig.siteName || 'Wedagedara'} Herbal Sanctuary`;

  // Build the vertical-dock social links from config (only entries with a URL).
  const heroSocialLinks = resolveHeroSocialLinks(heroSettings.socialLinks);

  const setSlide = useCallback(
    (index: number) => {
      const safeIndex = ((index % total) + total) % total;
      if (safeIndex === current || transitioning) return;
      setTransitioning(true);
      setExiting(true);

      window.setTimeout(() => {
        setExiting(false);
        setCurrent(safeIndex);
        window.setTimeout(() => setTransitioning(false), 400);
      }, 280);
    },
    [current, total, transitioning],
  );

  const next = useCallback(() => setSlide(current + 1), [current, setSlide]);
  const prev = useCallback(() => setSlide(current - 1), [current, setSlide]);

  // Autoplay (pause on hover).
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || total <= 1) return;
    const id = window.setInterval(() => setSlide((current + 1) % total), 6500);
    return () => window.clearInterval(id);
  }, [paused, current, total, setSlide]);

  // Keyboard navigation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev]);

  // Guarantee we have a valid slide to render (fallback always yields ≥1).
  if (!slide || total === 0) return null;

  return (
    <section
      id="hero-section"
      className="relative w-full h-screen min-h-[640px] flex items-center justify-center overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => {
        const t = e.touches[0];
        if (t) touchX.current = t.clientX;
      }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const t = e.changedTouches[0];
        const diff = touchX.current - (t ? t.clientX : touchX.current);
        if (Math.abs(diff) > 50) {
          if (diff > 0) next();
          else prev();
        }
        touchX.current = null;
      }}
    >
      {/* Background crossfade container */}
      <div id="hero-bg-container" className="absolute inset-0 z-0">
        {effectiveSlides.map((s, i) => (
          <div
            key={i}
            className={`hero-bg-slide ${i === current ? 'active' : ''}`}
            style={
              s.mediaType === 'video' ? undefined : { backgroundImage: `url('${s.mediaUrl}')` }
            }
          >
            {s.mediaType === 'video' && (
              <video src={s.mediaUrl} autoPlay muted loop playsInline className="w-full h-full object-cover" />
            )}
          </div>
        ))}
      </div>

      {/* Atmospheric vignette */}
      <div className="hero-vignette absolute inset-0 z-10 pointer-events-none" />

      {/* Main hero content */}
      <div
        id="hero-content"
        className="relative z-20 w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 pt-16 pb-12 h-full flex flex-col justify-between"
      >
        <div className="h-6" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center my-auto transition-transform duration-300">
          {/* Left column */}
          <div className="lg:col-span-7 flex flex-col justify-center">
            <div className={`slide-text-animate ${exiting ? 'animate-out' : ''} delay-100`}>
              <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-cinzel font-light tracking-wide text-white leading-tight drop-shadow-md">
                {split.main}
              </h1>
              <h2 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-cinzel font-bold tracking-tight text-white leading-tight drop-shadow-lg -mt-1 sm:-mt-2">
                {split.sub}
              </h2>
            </div>

            <div className={`slide-text-animate ${exiting ? 'animate-out' : ''} delay-200 flex items-center gap-3 sm:gap-4 mt-4 sm:mt-6 mb-6`}>
              <div className="w-10 sm:w-16 h-[1.5px] bg-white/70" />
              <span className="text-xs sm:text-sm md:text-base font-sans tracking-[0.25em] uppercase text-emerald-200/90 font-medium">
                {slide.subtitle ?? 'Ayurvedic Botanical Healing'}
              </span>
            </div>

            {heroSettings.showCraftedBy !== false && (
              <div className={`slide-text-animate ${exiting ? 'animate-out' : ''} delay-300`}>
                <p className="font-playfair italic text-xs sm:text-sm text-gray-400/90 tracking-wide">
                  {craftedByText}
                </p>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="lg:col-span-5 flex flex-col justify-center lg:pl-6">
            <div className="bg-black/30 p-6 sm:p-8 lg:p-10 rounded-2xl backdrop-blur-md border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
              <div className={`slide-text-animate ${exiting ? 'animate-out' : ''} delay-200`}>
                <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold uppercase tracking-wider text-[#97c93e] mt-1 mb-3">
                  {slide.title ?? 'VITALITY & WELLNESS'}
                </h3>
              </div>

              <div className={`slide-text-animate ${exiting ? 'animate-out' : ''} delay-300`}>
                <p className="text-xs sm:text-sm text-gray-300 leading-relaxed max-w-md mb-6 font-light">
                  {slide.description}
                </p>
              </div>

              <div className={`slide-text-animate ${exiting ? 'animate-out' : ''} delay-400 flex flex-wrap items-center gap-4`}>
                <a
                  href={slide.ctaLink ?? ROUTES.shop(tenantSlug)}
                  className="inline-flex items-center gap-2.5 px-6 py-2.5 rounded-full bg-[#97c93e] hover:bg-[#b2db58] text-black font-semibold text-xs sm:text-sm tracking-wider uppercase transition-all duration-300 shadow-md hover:scale-105 active:scale-95"
                >
                  <span>{slide.ctaText ?? 'Explore Remedies'}</span>
                  <i className="fa-solid fa-arrow-right text-xs" />
                </a>
                {heroSettings.showConsultDoctor !== false && (
                  <Link
                    href={heroSettings.consultDoctorLink || ROUTES.appointments(tenantSlug)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/20 hover:border-[#97c93e] text-white hover:text-[#b2db58] text-xs sm:text-sm font-medium tracking-wider transition-all duration-300"
                  >
                    <span>
                      {heroSettings.consultDoctorLabel || 'Consult Doctor'}
                    </span>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom row: dots (center) */}
        <div className="flex items-center justify-between pt-4 relative">
          <div className="w-16 hidden sm:block" />

          <div className="absolute left-1/2 -translate-x-1/2 bottom-0 flex items-center">
            <div className="flex items-center gap-3">
              {effectiveSlides.map((_, i) => (
                <button
                  key={i}
                  aria-label={`Go to slide ${i + 1}`}
                  className={`slider-dot ${i === current ? 'active' : ''}`}
                  onClick={() => setSlide(i)}
                />
              ))}
            </div>
          </div>

          <div className="w-16 hidden sm:block" />
        </div>
      </div>

      {/* Right vertical social dock (only renders when enabled + at least one link is set) */}
      {heroSettings.showSocialLinks !== false && heroSocialLinks.length > 0 && (
        <aside className="hidden lg:flex absolute right-6 xl:right-10 top-1/2 -translate-y-1/2 z-20 flex-col items-center gap-6 pointer-events-auto">
          <div className="w-[1.5px] h-20 bg-white/60" />
          <div className="flex flex-col items-center gap-4 text-white/80">
            {heroSocialLinks.map((social) => (
              <a
                key={social.platform}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#97c93e] hover:scale-125 transition-all text-sm"
                aria-label={social.label}
              >
                <i className={social.icon} />
              </a>
            ))}
          </div>
          <span className="writing-vertical text-xs font-sans tracking-[0.25em] text-gray-400/90 lowercase transform rotate-180">
            follow us
          </span>
        </aside>
      )}
    </section>
  );
}

/** A rendered social link in the hero vertical dock. */
interface HeroSocialLink {
  platform: string;
  label: string;
  href: string;
  icon: string;
}

/** Map configured hero social links to renderable entries (skips empty URLs). */
function resolveHeroSocialLinks(
  links?: Partial<WebsiteHeroSocialLinks>,
): HeroSocialLink[] {
  if (!links) return [];
  const templates: Record<string, { label: string; icon: string }> = {
    twitter: { label: 'Twitter', icon: 'fa-brands fa-x-twitter' },
    facebook: { label: 'Facebook', icon: 'fa-brands fa-facebook-f' },
    instagram: { label: 'Instagram', icon: 'fa-brands fa-instagram' },
    youtube: { label: 'YouTube', icon: 'fa-brands fa-youtube' },
    whatsapp: { label: 'WhatsApp', icon: 'fa-brands fa-whatsapp' },
  };
  return Object.entries(links)
    .filter(([, href]) => typeof href === 'string' && href.trim().length > 0)
    .map(([platform, href]) => {
      const tpl = templates[platform] ?? { label: platform, icon: 'fa-solid fa-link' };
      return {
        platform,
        label: tpl.label,
        href: href as string,
        icon: tpl.icon,
      };
    });
}

/** Fallback slides when the tenant has no active hero slides configured. */
function fallbackSlides(
  websiteConfig: WebsiteConfigData,
  tenantSlug: string,
): WebsiteHeroSlideData[] {
  return [
    {
      mediaType: 'image',
      mediaUrl:
        'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=2000&q=85',
      title: 'VITALITY & WELLNESS',
      subtitle: 'Ayurvedic Botanical Healing',
      description:
        'Experience the profound harmony of authentic Ayurvedic elixirs, hand-harvested from pristine medicinal forests to restore natural vitality and peace.',
      ctaText: 'Explore Remedies',
      ctaLink: ROUTES.shop(tenantSlug),
      isActive: true,
      sortOrder: 1,
    },
  ];
}
