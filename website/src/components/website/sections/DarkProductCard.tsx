'use client';

import React from 'react';
import Link from 'next/link';
import type { PublicProduct } from '@/types/website.types';
import { ROUTES } from '@/config/site';
import { formatLKR } from '@/lib/utils';

interface DarkProductCardProps {
  product: PublicProduct;
  tenantSlug: string;
  /** Visual variant: 'tilt' (products strip) or 'pill' (top-selling). */
  variant?: 'tilt' | 'pill';
  imageOverride?: string;
  priceOverride?: number;
  /** 1-based position in the slider, used for the reference "01 / 07" badge. */
  index?: number;
  /** Total number of cards in the slider. */
  total?: number;
}

function pickImage(p: PublicProduct): string | undefined {
  return p.mainImageUrl ?? p.variants?.[0]?.imageUrls?.[0] ?? p.primaryVariant?.imageUrls?.[0];
}
function pickPrice(p: PublicProduct): number {
  return p.variants?.[0]?.retailPrice ?? p.primaryVariant?.retailPrice ?? 0;
}

/**
 * Dark product card used by the Products / Top-Selling full-width sliders.
 * `tilt`  → image-square card for the "CURATED BOTANICAL COLLECTIONS" strip
 * `pill`  → 4:3 rounded pill silhouette for the "TOP SELLING ITEMS" strip
 */
export function DarkProductCard({
  product,
  tenantSlug,
  variant = 'tilt',
  imageOverride,
  priceOverride,
  index,
  total,
}: DarkProductCardProps) {
  const image = imageOverride ?? pickImage(product);
  const price = priceOverride ?? pickPrice(product);
  const href = ROUTES.product(tenantSlug, product.id);
  const position = String(index ?? 0).padStart(2, '0');
  const totalLabel = String(total ?? 0).padStart(2, '0');

  if (variant === 'pill') {
    return (
      <Link
        href={href}
        className="top-selling-card-wrap flex-shrink-0 w-[290px] sm:w-[320px] lg:w-[350px] xl:w-[370px] py-4"
      >
        <article className="top-selling-card p-4 sm:p-5 cursor-pointer group select-none theme-emerald">
          <div className="top-selling-img-wrap rounded-2xl mb-4">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt={product.name} loading="lazy" className="top-selling-img" />
            ) : (
              <div className="aspect-[4/3] flex items-center justify-center text-xs text-gray-500">
                Image unavailable
              </div>
            )}
            <div className="top-selling-img-fade" />
            <span className="top-selling-price-badge absolute bottom-3 left-3 z-10">
              {formatLKR(price)}
            </span>
          </div>

          <div className="px-1">
            <h3 className="text-lg sm:text-xl font-bold font-cinzel text-white leading-tight group-hover:text-[#97c93e] transition-colors line-clamp-1">
              {product.name}
            </h3>
            {product.description && (
              <p className="text-xs text-gray-300 font-light leading-relaxed mb-6 px-1 line-clamp-2 min-h-[2.5rem]">
                {product.description}
              </p>
            )}
            <button className="top-selling-action-btn">
              <span>View Details</span>
              <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" />
            </button>
          </div>
        </article>
      </Link>
    );
  }

  // tilt variant
  return (
    <Link
      href={href}
      className="product-card-wrap flex-shrink-0 py-4"
      style={{ width: 'clamp(260px, 30vw, 380px)' }}
    >
      <article className="product-card flex flex-col group cursor-pointer select-none bg-[#092218]/90 p-3 sm:p-4 rounded-xl border border-white/5 shadow-xl">
        <div className="product-image-wrap aspect-square bg-[#0d3022] rounded-lg shadow-2xl">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt={product.name}
              loading="lazy"
              className="product-slider-img w-full h-full object-cover object-center"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
              Image unavailable
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-70 group-hover:opacity-30 transition-opacity duration-500" />
          <div className="card-glare-overlay" />

          {/* Category indicator badge (reference-style "01 / 07") */}
          <div className="absolute top-3 left-3 z-20">
            <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[10px] tracking-widest uppercase text-[#97c93e] font-medium">
              {position} / {totalLabel}
            </span>
          </div>

          {/* Quick-view action button */}
          <div className="absolute bottom-3 right-3 z-20 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
            <span className="w-10 h-10 rounded-full bg-[#97c93e] text-black flex items-center justify-center text-xs shadow-xl hover:scale-110 transition-transform">
              <i className="fa-solid fa-arrow-up-right-from-square" />
            </span>
          </div>
        </div>

        <div className="product-card-content mt-3 px-1 text-center flex flex-col items-center pb-2">
          <h3 className="text-sm sm:text-base lg:text-lg font-semibold tracking-[0.2em] uppercase text-white group-hover:text-[#97c93e] transition-colors line-clamp-1">
            {product.name}
          </h3>
          {product.description && (
            <p className="text-[11px] sm:text-xs text-gray-400 font-light mt-1.5 line-clamp-1 max-w-[90%] font-sans">
              {product.description}
            </p>
          )}
          <span className="text-sm font-bold font-cinzel text-[#97c93e] mt-2">
            {formatLKR(price)}
          </span>
        </div>
      </article>
    </Link>
  );
}
