'use client';

import React from 'react';
import type { StoreReferenceSection as StoreReferenceSectionConfig } from '@/types/website.types';
import { SectionAmbience } from '@/components/website/sections/SectionAmbience';

interface StoreReferenceSectionProps {
  config: Record<string, unknown>;
  websiteConfig: Record<string, unknown>;
  tenantSlug: string;
}

/**
 * Section 09 — STORE REFERENCE (Glassmorphic Sanctuary Portal).
 * Full-bleed parallax background + radial vignette containing a glass box
 * (title, subtitle, address card) on the left and a dark-themed Google Map
 * on the right.
 */
export function StoreReferenceSection({ config }: StoreReferenceSectionProps) {
  const section = config as unknown as StoreReferenceSectionConfig;

  if (!section.isActive) return null;

  const bg = section.desktopImageUrl;
  const mapSrc = section.mapEmbedUrl;

  return (
    <section id="store-reference-section" className="relative w-full py-24 sm:py-32 lg:py-40 overflow-hidden border-t border-white/5">
      {/* Cinematic full-bleed background */}
      {bg && <div className="store-bg-layer" style={{ backgroundImage: `url('${bg}')` }} />}
      <div className="store-bg-vignette" />

      <SectionAmbience
        leaves={[
          { icon: 'fa-solid fa-seedling', classes: 'top-16 left-12 text-6xl text-[#97c93e]', speed: 0.22 },
          { icon: 'fa-solid fa-leaf', classes: 'bottom-20 right-10 text-7xl text-emerald-400', speed: 0.3 },
        ]}
        glows={['top-1/3 right-1/4 w-96 h-96 bg-[#97c93e]/10', 'bottom-10 left-1/4 w-80 h-80 bg-emerald-500/10']}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
        <div className="reveal-on-scroll store-portal-box">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left: title + subtitle + address */}
            <div className="lg:col-span-5 flex flex-col justify-center">
              <span className="text-xs font-semibold tracking-[0.3em] uppercase text-[#97c93e] block mb-3 font-sans">
                PHYSICAL SANCTUARY
              </span>
              <h2 className="store-title">{section.title}</h2>
              {section.subtitle && <p className="store-subtitle">{section.subtitle}</p>}

              {(section.addressLine1 || section.addressLine2) && (
                <div className="store-address-box">
                  <div className="store-address-icon">
                    <i className="fa-solid fa-location-dot" />
                  </div>
                  <div className="flex flex-col">
                    {section.addressLine1 && (
                      <span className="store-address-line1">{section.addressLine1}</span>
                    )}
                    {section.addressLine2 && (
                      <span className="store-address-line2">{section.addressLine2}</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right: map */}
            <div className="lg:col-span-7">
              <div className="store-map-frame">
                {mapSrc ? (
                  <iframe
                    title={section.title}
                    src={mapSrc}
                    className="store-map-iframe"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                    Map unavailable
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .store-bg-layer {
          position: absolute;
          inset: -60px 0 -60px 0;
          height: calc(100% + 120px);
          background-size: cover;
          background-position: center;
          filter: brightness(0.25) saturate(0.8);
          will-change: transform;
          z-index: 0;
        }
        .store-bg-vignette {
          position: absolute;
          inset: 0;
          background: radial-gradient(
            circle at 50% 50%,
            rgba(5, 22, 16, 0.75) 0%,
            rgba(5, 22, 16, 0.92) 65%,
            #051610 100%
          );
          z-index: 2;
          pointer-events: none;
        }
        .store-portal-box {
          background: rgba(8, 32, 23, 0.78);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 36px;
          padding: 32px 24px;
          box-shadow:
            0 25px 60px -15px rgba(0, 0, 0, 0.9),
            0 0 35px rgba(151, 201, 62, 0.08);
          z-index: 10;
          position: relative;
        }
        @media (min-width: 640px) {
          .store-portal-box {
            padding: 40px 36px;
          }
        }
        @media (min-width: 1024px) {
          .store-portal-box {
            padding: 56px 48px;
          }
        }
        .store-title {
          font-family: var(--font-serif);
          font-size: 2rem;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: 0.02em;
          line-height: 1.2;
        }
        @media (min-width: 640px) {
          .store-title {
            font-size: 2.5rem;
          }
        }
        @media (min-width: 1024px) {
          .store-title {
            font-size: 3rem;
          }
        }
        .store-subtitle {
          font-size: 0.9375rem;
          color: #cbd5e1;
          font-weight: 300;
          line-height: 1.7;
          margin-top: 16px;
        }
        @media (min-width: 640px) {
          .store-subtitle {
            font-size: 1rem;
          }
        }
        .store-address-box {
          display: flex;
          gap: 16px;
          margin-top: 28px;
          padding: 18px 22px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          transition: all 300ms ease;
        }
        .store-address-box:hover {
          background: rgba(151, 201, 62, 0.06);
          border-color: rgba(151, 201, 62, 0.25);
        }
        .store-address-icon {
          width: 44px;
          height: 44px;
          border-radius: 9999px;
          background: rgba(151, 201, 62, 0.15);
          border: 1px solid rgba(151, 201, 62, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #97c93e;
          font-size: 18px;
          flex-shrink: 0;
        }
        .store-address-line1 {
          font-family: var(--font-sans);
          font-size: 1rem;
          font-weight: 700;
          color: #ffffff;
        }
        @media (min-width: 640px) {
          .store-address-line1 {
            font-size: 1.0625rem;
          }
        }
        .store-address-line2 {
          font-family: var(--font-sans);
          font-size: 0.8125rem;
          color: #97c93e;
          letter-spacing: 0.04em;
          margin-top: 2px;
        }
        @media (min-width: 640px) {
          .store-address-line2 {
            font-size: 0.875rem;
          }
        }
        .store-map-frame {
          border-radius: 24px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: 0 20px 45px -10px rgba(0, 0, 0, 0.8);
          height: 320px;
          overflow: hidden;
          transform-style: preserve-3d;
        }
        @media (min-width: 640px) {
          .store-map-frame {
            height: 360px;
          }
        }
        @media (min-width: 1024px) {
          .store-map-frame {
            height: 400px;
          }
        }
        .store-map-iframe {
          width: 100%;
          height: 100%;
          border: 0;
          filter: grayscale(85%) invert(92%) hue-rotate(180deg) brightness(85%) contrast(110%);
          transition: filter 500ms ease;
        }
        .store-map-frame:hover .store-map-iframe {
          filter: grayscale(35%) invert(92%) hue-rotate(180deg) brightness(92%) contrast(105%);
        }
      `}</style>
    </section>
  );
}
