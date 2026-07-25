'use client';

import React from 'react';
import type { StoreReferenceSection as StoreReferenceSectionType } from '@/types/website.types';

interface StoreReferenceSectionProps {
  config: Record<string, unknown>;
  websiteConfig: Record<string, unknown>;
  tenantSlug: string;
}

/**
 * Section 08 — Store reference with full-width background image,
 * semi-transparent overlay on the right half, and an embedded Google Map.
 */
export function StoreReferenceSection({ config }: StoreReferenceSectionProps) {
  const sectionConfig = config as unknown as StoreReferenceSectionType;

  if (!sectionConfig.isActive) return null;

  const bgImage = sectionConfig.desktopImageUrl;
  if (!bgImage) return null;

  const mapUrl = sectionConfig.mapEmbedUrl || '';

  return (
    <section className="website-section mb-[8px]">
      <div className="store-reference">
        {/* Background image container */}
        <div
          className="store-reference-bg"
          style={{
            backgroundImage: `url(${bgImage})`,
          }}
        />

        {/* Content overlay — right half on desktop, full on mobile */}
        <div className="store-reference-overlay">
          <div className="store-reference-content">
            {sectionConfig.title && (
              <h2 className="store-reference-title">{sectionConfig.title}</h2>
            )}

            {sectionConfig.subtitle && (
              <p className="store-reference-subtitle">{sectionConfig.subtitle}</p>
            )}

            {sectionConfig.addressLine1 && (
              <p className="store-reference-address">{sectionConfig.addressLine1}</p>
            )}

            {sectionConfig.addressLine2 && (
              <p className="store-reference-address">{sectionConfig.addressLine2}</p>
            )}

            {mapUrl && (
              <div className="store-reference-map">
                <iframe
                  src={mapUrl}
                  width="100%"
                  height="200"
                  style={{ border: 0, borderRadius: '4px' }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Store location map"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .store-reference {
          position: relative;
          width: 100%;
          max-height: 800px;
          min-height: 400px;
          overflow: hidden;
        }

        /* Full-width background image */
        .store-reference-bg {
          position: absolute;
          inset: 0;
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          z-index: 0;
        }

        /* Overlay — right half on desktop, full width on mobile */
        .store-reference-overlay {
          position: absolute;
          top: 0;
          bottom: 0;
          right: 0;
          width: 50%;
          z-index: 1;
          background: linear-gradient(
            to right,
            rgba(43, 37, 32, 0.1),
            rgba(43, 37, 32, 0.75) 30%,
            rgba(43, 37, 32, 0.85)
          );
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .store-reference-content {
          padding: 40px 32px;
          max-width: 420px;
          width: 100%;
          text-align: center;
        }

        .store-reference-title {
          font-family: 'Cormorant Garamond', 'Times New Roman', serif;
          font-size: 36px;
          font-weight: 400;
          color: #ffffff;
          margin-bottom: 12px;
          line-height: 1.2;
        }

        .store-reference-subtitle {
          font-size: 15px;
          color: #f5ede3;
          margin-bottom: 16px;
          line-height: 1.5;
          font-family: 'Montserrat', sans-serif;
        }

        .store-reference-address {
          font-size: 13px;
          color: #d1c4b8;
          margin-bottom: 6px;
          line-height: 1.6;
          font-family: 'Montserrat', sans-serif;
        }

        .store-reference-map {
          margin-top: 20px;
          width: 100%;
        }

        /* Mobile */
        @media (max-width: 768px) {
          .store-reference {
            max-height: none;
            min-height: 500px;
          }

          .store-reference-overlay {
            position: absolute;
            top: auto;
            bottom: 0;
            left: 0;
            right: 0;
            width: 100%;
            height: auto;
            min-height: 55%;
            background: linear-gradient(
              to top,
              rgba(43, 37, 32, 0.92),
              rgba(43, 37, 32, 0.6) 60%,
              rgba(43, 37, 32, 0.1)
            );
            align-items: flex-end;
          }

          .store-reference-content {
            padding: 32px 20px 40px;
            max-width: 100%;
          }

          .store-reference-title {
            font-size: 28px;
          }

          .store-reference-subtitle {
            font-size: 14px;
          }
        }

        @media (max-width: 480px) {
          .store-reference {
            min-height: 420px;
          }

          .store-reference-title {
            font-size: 24px;
          }

          .store-reference-content {
            padding: 24px 16px 32px;
          }
        }
      `}</style>
    </section>
  );
}
