'use client';

import React from 'react';
import Link from 'next/link';
import type { LatestProductsSection, PublicProduct } from '@/types/website.types';
import { SectionTitle } from '@/components/website/sections/SectionTitle';
import { SectionAmbience } from '@/components/website/sections/SectionAmbience';
import { ROUTES } from '@/config/site';
import { formatLKR } from '@/lib/utils';

interface LatestProductsProps {
  config: Record<string, unknown>;
  websiteConfig: Record<string, unknown>;
  tenantSlug: string;
  latestProducts?: PublicProduct[];
}

function pickDisplayImage(product: PublicProduct): string | undefined {
  return (
    product.mainImageUrl ??
    product.variants?.[0]?.imageUrls?.[0] ??
    product.primaryVariant?.imageUrls?.[0]
  );
}
function pickDisplayPrice(product: PublicProduct): number {
  return product.variants?.[0]?.retailPrice ?? product.primaryVariant?.retailPrice ?? 0;
}

/**
 * Section 07 — "LATEST PRODUCTS" asymmetric editorial grid.
 * Desktop: 12-col asymmetric mesh (feature 7-col + 5/3 mix). Collapses to
 * 2-col (tablet) / 1-col (mobile). Glassmorphic cards with image aura + glare.
 */
export function LatestProducts({ config, tenantSlug, latestProducts }: LatestProductsProps) {
  const section = config as unknown as LatestProductsSection;

  let source = latestProducts ?? [];
  if (section.productIds && section.productIds.length > 0) {
    const idSet = new Set(section.productIds);
    source = source.filter((p) => idSet.has(p.id));
  }
  const display = source.slice(0, section.productCount || 7);
  if (display.length === 0) return null;

  const title = section.title || 'Latest Products';

  return (
    <section id="latest-products-section" className="section-dark relative w-full py-20 sm:py-28 lg:py-36 overflow-hidden">
      <SectionAmbience
        leaves={[
          { icon: 'fa-solid fa-leaf', classes: 'top-12 left-10 text-6xl text-[#97c93e]', speed: 0.22 },
          { icon: 'fa-solid fa-seedling', classes: 'bottom-20 right-8 text-7xl text-emerald-400', speed: 0.3 },
          { icon: 'fa-solid fa-spa', classes: 'top-1/2 left-4 text-4xl text-lime-300', speed: 0.16 },
        ]}
        glows={['top-0 right-1/4 w-96 h-96 bg-[#97c93e]/10', 'bottom-10 left-1/3 w-80 h-80 bg-emerald-500/10']}
      />

      <SectionTitle label="NEW HERBAL ARRIVALS" title={title} />

      <div className="reveal-on-scroll relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
        <div className="latest-editorial-grid">
          {display.map((product, i) => (
            <Link
              key={product.id}
              href={ROUTES.product(tenantSlug, product.id)}
              className={`latest-product-card latest-mesh-${i + 1} group select-none`}
            >
              <div className="latest-img-frame">
                {pickDisplayImage(product) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pickDisplayImage(product)}
                    alt={product.name}
                    loading="lazy"
                    className="latest-product-img"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                    Image unavailable
                  </div>
                )}
                <div className="latest-img-aura" />
                <div className="latest-glare-overlay" />
              </div>
              <div className="latest-content">
                <h3 className="latest-title">{product.name}</h3>
                <div className="latest-price-row">
                  <span className="latest-price">{formatLKR(pickDisplayPrice(product))}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <style jsx>{`
        .latest-editorial-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 18px;
        }
        @media (min-width: 640px) and (max-width: 1023px) {
          .latest-editorial-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 20px;
          }
          .latest-mesh-1 {
            grid-column: span 2;
          }
        }
        @media (min-width: 1024px) {
          .latest-editorial-grid {
            grid-template-columns: repeat(12, minmax(0, 1fr));
            gap: 24px;
          }
          .latest-mesh-1 {
            grid-column: span 7;
            grid-row: span 2;
            display: flex;
            flex-direction: column;
            height: 100%;
          }
          .latest-mesh-2 {
            grid-column: span 5;
          }
          .latest-mesh-3 {
            grid-column: span 5;
          }
          .latest-mesh-4 {
            grid-column: span 3;
          }
          .latest-mesh-5 {
            grid-column: span 3;
          }
          .latest-mesh-6 {
            grid-column: span 3;
          }
          .latest-mesh-7 {
            grid-column: span 3;
          }
        }

        .latest-product-card {
          position: relative;
          background: rgba(8, 32, 23, 0.65);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 28px;
          padding: 16px;
          box-shadow: 0 15px 35px -5px rgba(0, 0, 0, 0.6);
          cursor: pointer;
          overflow: hidden;
          transform-style: preserve-3d;
          transition:
            transform 450ms cubic-bezier(0.16, 1, 0.3, 1),
            box-shadow 450ms cubic-bezier(0.16, 1, 0.3, 1),
            border-color 350ms ease;
          will-change: transform, box-shadow;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        @media (min-width: 640px) {
          .latest-product-card {
            padding: 20px;
          }
        }
        .latest-product-card:hover {
          transform: translateY(-8px);
          border-color: rgba(151, 201, 62, 0.45);
          box-shadow:
            0 25px 50px -10px rgba(0, 0, 0, 0.85),
            0 0 30px rgba(151, 201, 62, 0.16);
        }

        .latest-img-frame {
          position: relative;
          width: 100%;
          aspect-ratio: 4 / 3;
          border-radius: 20px;
          overflow: hidden;
          background: #051610;
          display: flex;
          align-items: center;
          justify-content: center;
          transform: translateZ(15px);
          box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.5);
        }
        @media (min-width: 1024px) {
          .latest-mesh-1 .latest-img-frame {
            flex: 1 1 0%;
            height: 100%;
            aspect-ratio: auto;
            min-height: 380px;
          }
          .latest-mesh-2 .latest-img-frame,
          .latest-mesh-3 .latest-img-frame {
            aspect-ratio: 16 / 10;
          }
          .latest-mesh-4 .latest-img-frame,
          .latest-mesh-5 .latest-img-frame,
          .latest-mesh-6 .latest-img-frame,
          .latest-mesh-7 .latest-img-frame {
            aspect-ratio: 1 / 1;
          }
        }

        .latest-img-aura {
          position: absolute;
          inset: 0;
          background: radial-gradient(
            circle at 50% 50%,
            rgba(151, 201, 62, 0.22) 0%,
            rgba(8, 32, 23, 0) 70%
          );
          opacity: 0.6;
          transition:
            opacity 400ms ease,
            transform 400ms ease;
          pointer-events: none;
          z-index: 5;
        }
        .latest-product-card:hover .latest-img-aura {
          opacity: 1;
          transform: scale(1.18);
        }
        .latest-product-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          transition: transform 700ms cubic-bezier(0.2, 1, 0.3, 1);
          will-change: transform;
          z-index: 1;
        }
        .latest-product-card:hover .latest-product-img {
          transform: scale(1.08);
        }
        .latest-glare-overlay {
          position: absolute;
          inset: 0;
          border-radius: 28px;
          background: radial-gradient(
            circle at 50% 50%,
            rgba(255, 255, 255, 0.2) 0%,
            rgba(255, 255, 255, 0) 65%
          );
          opacity: 0;
          pointer-events: none;
          transition: opacity 300ms ease;
          z-index: 15;
          mix-blend-mode: overlay;
        }

        .latest-content {
          margin-top: 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          transform: translateZ(20px);
          width: 100%;
          flex-shrink: 0;
        }
        @media (min-width: 1024px) {
          .latest-mesh-1 .latest-content {
            margin-top: 18px;
          }
        }
        .latest-title {
          font-family: var(--font-serif);
          font-size: 0.9375rem;
          font-weight: 700;
          line-height: 1.35;
          color: #ffffff;
          letter-spacing: 0.02em;
          transition: color 300ms ease;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          word-break: break-word;
        }
        @media (min-width: 640px) {
          .latest-title {
            font-size: 1.0625rem;
          }
        }
        @media (min-width: 1024px) {
          .latest-mesh-1 .latest-title {
            font-size: 1.25rem;
          }
        }
        .latest-product-card:hover .latest-title {
          color: #97c93e;
        }
        .latest-price-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 2px;
        }
        .latest-price {
          font-family: var(--font-serif);
          font-size: 0.9375rem;
          font-weight: 700;
          color: #97c93e;
          letter-spacing: 0.02em;
          white-space: nowrap;
        }
        @media (min-width: 640px) {
          .latest-price {
            font-size: 1.0625rem;
          }
        }
        .latest-mesh-1 .latest-price {
          font-size: 1.125rem;
        }
      `}</style>
    </section>
  );
}
