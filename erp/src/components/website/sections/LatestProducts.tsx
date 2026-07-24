'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { LatestProductsSection } from '@/types/website.types';

interface LatestProductsProps {
  config: Record<string, unknown>;
  websiteConfig: Record<string, unknown>;
  tenantSlug: string;
}

// Placeholder product data
const PLACEHOLDER_PRODUCTS = [
  { id: '1', name: 'Vitamin C Brightening Cream', price: 'Rs. 4,500', image: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=400&h=400&fit=crop' },
  { id: '2', name: 'Green Tea Face Wash', price: 'Rs. 2,800', image: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400&h=400&fit=crop' },
  { id: '3', name: 'Advanced Repair Serum', price: 'Rs. 5,200', image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400&h=400&fit=crop' },
  { id: '4', name: 'Saffron Day Cream', price: 'Rs. 3,900', image: 'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=400&h=400&fit=crop' },
  { id: '5', name: 'Sandalwood Body Lotion', price: 'Rs. 3,200', image: 'https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=400&h=400&fit=crop' },
  { id: '6', name: 'Kasturi Kaha Night Cream', price: 'Rs. 4,800', image: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=400&h=400&fit=crop' },
];

export function LatestProducts({ config, tenantSlug }: LatestProductsProps) {
  const sectionConfig = config as unknown as LatestProductsSection;
  const [scrollIndex, setScrollIndex] = useState(0);
  const itemsPerView = typeof window !== 'undefined' && window.innerWidth >= 768 ? 5 : 2;

  const products = PLACEHOLDER_PRODUCTS.slice(0, sectionConfig.productCount || 10);
  const maxIndex = Math.max(0, products.length - itemsPerView);

  const scroll = (direction: 'left' | 'right') => {
    setScrollIndex((prev) => {
      if (direction === 'left') return Math.max(0, prev - 1);
      return Math.min(maxIndex, prev + 1);
    });
  };

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
              {products.map((product) => (
                <div
                  key={product.id}
                  className="flex-shrink-0 px-2"
                  style={{ width: `${100 / itemsPerView}%` }}
                >
                  <Link
                    href={`/site/${tenantSlug}/product/${product.id}`}
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

          {products.length > itemsPerView && (
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
