/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { BestSellingSection, PublicProduct } from '@/types/website.types';
import { tenantHomePath } from '@/lib/tenant';
import { formatLKR } from '@/lib/utils';

interface BestSellingProps {
  config: Record<string, unknown>;
  websiteConfig: Record<string, unknown>;
  tenantSlug: string;
  /** Real products from the ERP API. Falls back to placeholders when missing. */
  products?: PublicProduct[];
}

const PLACEHOLDER_PRODUCTS: PublicProduct[] = [
  {
    id: '7',
    name: 'Bestseller Skincare Duo',
    variants: [
      {
        id: '7-1',
        sku: 'BSSD-01',
        retailPrice: 8500,
        imageUrls: [
          'https://images.unsplash.com/photo-1570194065650-d99fb4ee8e3e?w=400&h=400&fit=crop',
        ],
        stockQuantity: 0,
        productId: '7',
      },
    ],
    tags: [],
  },
  {
    id: '8',
    name: 'Skin Glowing Starter Kit',
    variants: [
      {
        id: '8-1',
        sku: 'SGSK-01',
        retailPrice: 6200,
        imageUrls: [
          'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&h=400&fit=crop',
        ],
        stockQuantity: 0,
        productId: '8',
      },
    ],
    tags: [],
  },
  {
    id: '9',
    name: 'Kasturi Kaha Night Cream',
    variants: [
      {
        id: '9-1',
        sku: 'KKNC-01',
        retailPrice: 4800,
        imageUrls: [
          'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=400&h=400&fit=crop',
        ],
        stockQuantity: 0,
        productId: '9',
      },
    ],
    tags: [],
  },
  {
    id: '10',
    name: 'Saffron Day Cream',
    variants: [
      {
        id: '10-1',
        sku: 'SDC-01',
        retailPrice: 3900,
        imageUrls: [
          'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=400&h=400&fit=crop',
        ],
        stockQuantity: 0,
        productId: '10',
      },
    ],
    tags: [],
  },
  {
    id: '11',
    name: 'Kasturi Kaha Face Wash',
    variants: [
      {
        id: '11-1',
        sku: 'KKFW-01',
        retailPrice: 2800,
        imageUrls: [
          'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400&h=400&fit=crop',
        ],
        stockQuantity: 0,
        productId: '11',
      },
    ],
    tags: [],
  },
];

type DisplayProduct = {
  id: string;
  name: string;
  price: string;
  image: string;
};

function pickDisplayImage(p: PublicProduct): string {
  return (
    p.variants?.[0]?.imageUrls?.[0] ??
    p.primaryVariant?.imageUrls?.[0] ??
    'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=400&h=400&fit=crop'
  );
}

function pickDisplayPrice(p: PublicProduct): number {
  return (
    p.variants?.[0]?.retailPrice ??
    p.primaryVariant?.retailPrice ??
    0
  );
}

/**
 * Best-selling products carousel. When `products` is provided (from the ERP
 * API) it is rendered; otherwise falls back to placeholder fixtures.
 */
export function BestSelling({ config, tenantSlug, products }: BestSellingProps) {
  const sectionConfig = config as unknown as BestSellingSection;
  const [scrollIndex, setScrollIndex] = useState(0);
  const [itemsPerView, setItemsPerView] = useState(2);

  // Responsive items per view
  React.useEffect(() => {
    const compute = () => setItemsPerView(window.innerWidth >= 768 ? 5 : 2);
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  const source: PublicProduct[] = products && products.length > 0 ? products : PLACEHOLDER_PRODUCTS;
  const display: DisplayProduct[] = source
    .slice(0, sectionConfig.productCount || 10)
    .map((p) => ({
      id: p.id,
      name: p.name,
      price: formatLKR(pickDisplayPrice(p)),
      image: pickDisplayImage(p),
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
    <section className="py-12 md:py-16 bg-white">
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