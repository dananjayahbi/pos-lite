'use client';

import React from 'react';
import Link from 'next/link';
import type { CategoriesSection } from '@/types/website.types';

interface CategoryGridProps {
  config: Record<string, unknown>;
  websiteConfig: Record<string, unknown>;
  tenantSlug: string;
}

// Placeholder category images — replace with real data
const PLACEHOLDER_IMAGES = [
  'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=400&h=400&fit=crop',
];

export function CategoryGrid({ config, tenantSlug }: CategoryGridProps) {
  const sectionConfig = config as unknown as CategoriesSection;

  return (
    <section className="py-12 md:py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        {sectionConfig.title && (
          <div className="section-title">
            <h3 className="section-title-main">{sectionConfig.title}</h3>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(sectionConfig.categoryIds ?? []).slice(0, 4).map((catId, i) => (
            <Link
              key={catId}
              href={`/site/${tenantSlug}/category/${catId}`}
              className="category-card group"
            >
              <div className="category-card-image">
                <img
                  src={PLACEHOLDER_IMAGES[i % PLACEHOLDER_IMAGES.length]}
                  alt={`Category ${i + 1}`}
                  loading="lazy"
                />
              </div>
              <div className="p-3 text-center bg-white">
                <h4 className="text-xs md:text-sm uppercase tracking-wider font-medium">
                  Category {i + 1}
                </h4>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
