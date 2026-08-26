'use client';

import React from 'react';
import { buildShopUrl } from '@/lib/api/shopQuery';
import type { PublicCategory, PublicConcern } from '@/types/website.types';
import { FilterPills } from './FilterPills';
import { PriceRangeFilter } from './PriceRangeFilter';

interface ShopFiltersProps {
  categories: PublicCategory[];
  tenantSlug: string;
  selectedCategory?: string | undefined;
  selectedSort?: string | undefined;
  concerns: PublicConcern[];
  forms: string[];
  selectedConcern?: string | undefined;
  selectedForm?: string | undefined;
  priceMin?: number | undefined;
  priceMax?: number | undefined;
  priceBounds: { min: number; max: number };
}

const SORT_OPTIONS = [
  { value: 'latest', label: 'Latest' },
  { value: 'best-selling', label: 'Best Selling' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
];

/**
 * Filter panel for the shop page. Category, health-concern and form pills
 * plus a price range and sort control all compose through the shared
 * URL query-state model (`buildShopUrl`) so they persist and reset together.
 */
export function ShopFilters({
  categories,
  tenantSlug,
  selectedCategory,
  selectedSort,
  concerns,
  forms,
  selectedConcern,
  selectedForm,
  priceMin,
  priceMax,
  priceBounds,
}: ShopFiltersProps) {
  function buildHref(overrides: {
    category?: string | undefined;
    sort?: string | undefined;
    concern?: string | undefined;
    form?: string | undefined;
    priceMin?: number | undefined;
    priceMax?: number | undefined;
  }): string {
    return buildShopUrl(tenantSlug, {
      category: overrides.category !== undefined ? overrides.category : selectedCategory,
      sort: overrides.sort !== undefined ? overrides.sort : selectedSort,
      concern: overrides.concern !== undefined ? overrides.concern : selectedConcern,
      form: overrides.form !== undefined ? overrides.form : selectedForm,
      priceMin: overrides.priceMin !== undefined ? overrides.priceMin : priceMin,
      priceMax: overrides.priceMax !== undefined ? overrides.priceMax : priceMax,
    });
  }

  return (
    <div className="space-y-4">
      {/* Category pills */}
      {categories.length > 0 && (
        <FilterPills
          label="Category"
          options={categories.map((c) => ({ id: c.id, label: c.name }))}
          selectedId={selectedCategory}
          buildHref={(id) => buildHref({ category: id })}
        />
      )}

      {/* Health-concern pills */}
      {concerns.length > 0 && (
        <FilterPills
          label="Concern"
          options={concerns.map((c) => ({ id: c.value, label: c.label }))}
          selectedId={selectedConcern}
          buildHref={(id) => buildHref({ concern: id })}
        />
      )}

      {/* Form / type pills */}
      {forms.length > 0 && (
        <FilterPills
          label="Type"
          options={forms.map((f) => ({ id: f, label: f }))}
          selectedId={selectedForm}
          buildHref={(id) => buildHref({ form: id })}
        />
      )}

      {/* Price range + sort */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PriceRangeFilter
          bounds={priceBounds}
          valueMin={priceMin}
          valueMax={priceMax}
          onApply={(min, max) => {
            window.location.href = buildHref({ priceMin: min, priceMax: max });
          }}
        />

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Sort:</span>
          <select
            className="rounded border border-gray-300 px-2 py-1.5 text-xs bg-white focus:border-black focus:ring-1 focus:ring-black outline-none"
            value={selectedSort || 'latest'}
            onChange={(e) => {
              window.location.href = buildHref({ sort: e.target.value });
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
    </div>
  );
}
