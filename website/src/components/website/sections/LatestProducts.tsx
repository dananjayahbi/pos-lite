/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type {
  LatestProductsSection,
  PublicProduct,
} from '@/types/website.types';
import { tenantHomePath } from '@/lib/tenant';
import { formatLKR } from '@/lib/utils';

interface LatestProductsProps {
  config: Record<string, unknown>;
  websiteConfig: Record<string, unknown>;
  tenantSlug: string;
  /** Real products from the ERP API. Falls back to placeholders when missing. */
  products?: PublicProduct[];
}

const PLACEHOLDER_PRODUCTS: PublicProduct[] = [
  {
    id: '1',
    name: 'Vitamin C Brightening Cream',
    variants: [
      {
        id: '1-1',
        sku: 'VCBC-01',
        retailPrice: 4500,
        imageUrls: [
          'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=400&h=400&fit=crop',
        ],
        stockQuantity: 0,
        productId: '1',
      },
    ],
    tags: [],
  },
  {
    id: '2',
    name: 'Green Tea Face Wash',
    variants: [
      {
        id: '2-1',
        sku: 'GTFW-01',
        retailPrice: 2800,
        imageUrls: [
          'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400&h=400&fit=crop',
        ],
        stockQuantity: 0,
        productId: '2',
      },
    ],
    tags: [],
  },
  {
    id: '3',
    name: 'Advanced Repair Serum',
    variants: [
      {
        id: '3-1',
        sku: 'ARS-01',
        retailPrice: 5200,
        imageUrls: [
          'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400&h=400&fit=crop',
        ],
        stockQuantity: 0,
        productId: '3',
      },
    ],
    tags: [],
  },
  {
    id: '4',
    name: 'Saffron Day Cream',
    variants: [
      {
        id: '4-1',
        sku: 'SDC-01',
        retailPrice: 3900,
        imageUrls: [
          'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=400&h=400&fit=crop',
        ],
        stockQuantity: 0,
        productId: '4',
      },
    ],
    tags: [],
  },
  {
    id: '5',
    name: 'Sandalwood Body Lotion',
    variants: [
      {
        id: '5-1',
        sku: 'SBL-01',
        retailPrice: 3200,
        imageUrls: [
          'https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=400&h=400&fit=crop',
        ],
        stockQuantity: 0,
        productId: '5',
      },
    ],
    tags: [],
  },
  {
    id: '6',
    name: 'Kasturi Kaha Night Cream',
    variants: [
      {
        id: '6-1',
        sku: 'KKNC-01',
        retailPrice: 4800,
        imageUrls: [
          'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=400&h=400&fit=crop',
        ],
        stockQuantity: 0,
        productId: '6',
      },
    ],
    tags: [],
  },
];

type DisplayProduct = { id: string; name: string; price: string; image: string };

function pickImage(p: PublicProduct): string {
  return (
    p.variants?.[0]?.imageUrls?.[0] ??
    p.primaryVariant?.imageUrls?.[0] ??
    'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=400&h=400&fit=crop'
  );
}

function pickPrice(p: PublicProduct): number {
  return p.variants?.[0]?.retailPrice ?? p.primaryVariant?.retailPrice ?? 0;
}

/**
 * Latest-products carousel. When `products` is provided (from the ERP API)
 * it is rendered; otherwise falls back to placeholder fixtures.
 */
export function LatestProducts({
  config,
  tenantSlug,
  products,
}: LatestProductsProps) {
  const sectionConfig = config as unknown as LatestProductsSection;
  const [scrollIndex, setScrollIndex] = useState(0);
  const [itemsPerView, setItemsPerView] = useState(2);

  useEffect(() => {
    const compute = () => setItemsPerView(window.innerWidth >= 768 ? 5 : 2);
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  const source: PublicProduct[] =
    products && products.length > 0 ? products : PLACEHOLDER_PRODUCTS;
  const display: DisplayProduct[] = source
    .slice(0, sectionConfig.productCount || 10)
    .map((p) => ({
      id: p.id,
      name: p.name,
      price: formatLKR(pickPrice(p)),
      image: pickImage(p),
    }));

  const maxIndex = Math.max(0, display.length - itemsPerView);

  const scroll = (direction: 'left' | 'right') => {
    setScrollIndex((prev) => {
      if (direction === 'left') return Math.max(0, prev - 1);
      return Math.min(maxIndex, prev + 1);
    });
  };

  if (display.length === 0) return null;

  return (
    <section className="py-12 md:py-16 bg-[#f5f5f5]">
      <div className="max-w-7xl mx-auto px-4">
        {sectionConfig.title && (
          <div className="section-title">
            <h3 className="section-title-main">{sectionConfig.title}</h3>
          </div>
        )}

        <div className="relative">
          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${scrollIndex * (100 / itemsPerView)}%)` }}
            >
              {display.map((product) => (
                <div
                  key={product.id}
                  className="flex-shrink-0 px-2"
                  style={{ width: `${100 / itemsPerView}%` }}
                >
                  <Link
                    href={`${tenantHomePath(tenantSlug)}/product/${product.id}`}
                    className="product-card group block"
                  >
                    <div className="product-card-image">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="primary"
                        loading="lazy"
                      />
                    </div>
                    <div className="p-3 text-center">
                      <h4 className="text-xs md:text-sm font-medium mb-1 line-clamp-2">
                        {product.name}
                      </h4>
                      <p className="text-sm font-semibold">{product.price}</p>
                      <button className="mt-2 w-full py-2 border border-black text-xs uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black hover:text-white">
                        Add to Bag
                      </button>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {display.length > itemsPerView && (
            <>
              <button
                onClick={() => scroll('left')}
                disabled={scrollIndex === 0}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors z-10"
                aria-label="Previous products"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => scroll('right')}
                disabled={scrollIndex >= maxIndex}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors z-10"
                aria-label="Next products"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}