'use client';

import React from 'react';
import Link from 'next/link';
import { tenantHomePath } from '@/lib/tenant';
import type { PublicCategory } from '@/types/website.types';

interface ShopFiltersProps {
  categories: PublicCategory[];
  tenantSlug: string;
  selectedCategory?: string | undefined;
  selectedSort?: string | undefined;
}

const SORT_OPTIONS = [
  { value: 'latest', label: 'Latest' },
  { value: 'best-selling', label: 'Best Selling' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
];

/**
 * Category and sort filters for the shop page.
 */
export function ShopFilters({
  categories,
  tenantSlug,
  selectedCategory,
  selectedSort,
}: ShopFiltersProps) {
  const homePath = tenantHomePath(tenantSlug);

  function buildHref(categoryId?: string, sort?: string): string {
    const params = new URLSearchParams();
    if (categoryId) params.set('category', categoryId);
    if (sort && sort !== 'latest') params.set('sort', sort);
    const query = params.toString();
    return `${homePath}/shop${query ? `?${query}` : ''}`;
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      {/* Category pills */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Link
            href={buildHref(undefined, selectedSort)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              !selectedCategory
                ? 'border-black bg-black text-white'
                : 'border-gray-300 text-gray-600 hover:border-gray-500'
            }`}
          >
            All
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={buildHref(cat.id, selectedSort)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedCategory === cat.id
                  ? 'border-black bg-black text-white'
                  : 'border-gray-300 text-gray-600 hover:border-gray-500'
              }`}
            >
              {cat.name}
            </Link>
          ))}
        </div>
      )}

      {/* Sort dropdown (as links) */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Sort:</span>
        <select
          className="rounded border border-gray-300 px-2 py-1.5 text-xs bg-white focus:border-black focus:ring-1 focus:ring-black outline-none"
          value={selectedSort || 'latest'}
          onChange={(e) => {
            window.location.href = buildHref(selectedCategory, e.target.value);
          }}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
