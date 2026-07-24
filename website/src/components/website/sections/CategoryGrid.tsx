/* eslint-disable @next/next/no-img-element */
'use client';

import React from 'react';
import Link from 'next/link';
import type { CategoriesSection, PublicCategory } from '@/types/website.types';
import { tenantHomePath } from '@/lib/tenant';

interface CategoryGridProps {
  config: Record<string, unknown>;
  websiteConfig: Record<string, unknown>;
  tenantSlug: string;
  /** Real categories from the ERP API. Falls back to placeholder IDs when missing. */
  categories?: PublicCategory[];
}

const PLACEHOLDER_IMAGES = [
  'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=400&h=400&fit=crop',
];

type DisplayCategory = {
  id: string;
  name: string;
  imageUrl: string;
  href: string;
};

/**
 * 4-column category grid. When real categories are passed in (from the ERP
 * API), they are rendered with their actual names and images. Otherwise the
 * configured `categoryIds` are resolved against the placeholder image list
 * so the layout still has something to render.
 */
export function CategoryGrid({ config, tenantSlug, categories }: CategoryGridProps) {
  const sectionConfig = config as unknown as CategoriesSection;

  const items: DisplayCategory[] = (() => {
    if (categories && categories.length > 0) {
      return categories.slice(0, 4).map((cat) => ({
        id: cat.id,
        name: cat.name,
        imageUrl:
          cat.imageUrl ?? PLACEHOLDER_IMAGES[0] ?? PLACEHOLDER_IMAGES[0]!,
        href: `${tenantHomePath(tenantSlug)}/category/${cat.id}`,
      }));
    }

    const ids = sectionConfig.categoryIds ?? [];
    return ids.slice(0, 4).map((id, i) => ({
      id,
      name: `Category ${i + 1}`,
      imageUrl: PLACEHOLDER_IMAGES[i % PLACEHOLDER_IMAGES.length]!,
      href: `${tenantHomePath(tenantSlug)}/category/${id}`,
    }));
  })();

  if (items.length === 0) return null;

  return (
    <section className="py-12 md:py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        {sectionConfig.title && (
          <div className="section-title">
            <h3 className="section-title-main">{sectionConfig.title}</h3>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {items.map((cat) => (
            <Link key={cat.id} href={cat.href} className="category-card group">
              <div className="category-card-image">
                <img src={cat.imageUrl} alt={cat.name} loading="lazy" />
              </div>
              <div className="p-3 text-center bg-white">
                <h4 className="text-xs md:text-sm uppercase tracking-wider font-medium">
                  {cat.name}
                </h4>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}