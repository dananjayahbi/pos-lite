'use client';

import React from 'react';
import type { PublicCategory, PublicConcern, PublicProduct } from '@/types/website.types';
import { priceBounds } from '@/lib/api/shopQuery';
import { useShopFilters, type ShopFilterState } from './useShopFilters';
import { ShopFilterPanel } from './ShopFilterPanel';
import { ShopFilterDrawer } from './ShopFilterDrawer';
import { ShopProductMesh } from './ShopProductMesh';
import { ResultsStatusBar } from './ResultsStatusBar';

interface ShopCatalogClientProps {
  tenantSlug: string;
  /** Full catalog (all products for the tenant), unfiltered. */
  products: PublicProduct[];
  categories: PublicCategory[];
  concerns: PublicConcern[];
  forms: string[];
  /** Initial filter state read from the URL search params. */
  initial: ShopFilterState;
  /** Called whenever the filter state changes (used to sync the URL). */
  onFiltersChange?: (state: ShopFilterState) => void;
}

export type { ShopCatalogClientProps };

/**
 * Client-side shop catalog.
 *
 * Receives the full catalog from the server component and holds the active
 * filters in local state, filtering the products in-memory. Applying any
 * filter is instant — no page reload, no scroll reset — because the URL is
 * synced via `history.replaceState` while the user stays put.
 */
export function ShopCatalogClient({
  tenantSlug,
  products,
  categories,
  concerns,
  forms,
  initial,
  onFiltersChange,
}: ShopCatalogClientProps) {
  const {
    state,
    filtered,
    setCategory,
    setConcern,
    setForm,
    setSort,
    setPrice,
    setQuery,
  } = useShopFilters({
    initial,
    products,
    ...(onFiltersChange ? { onQueryChange: onFiltersChange } : {}),
  });

  const bounds = priceBounds(products);

  const panelProps = {
    categories,
    concerns,
    forms,
    tenantSlug,
    selectedCategory: state.category,
    selectedConcern: state.concern,
    selectedForm: state.form,
    selectedSort: state.sort,
    priceMin: state.priceMin,
    priceMax: state.priceMax,
    priceBounds: bounds,
    onCategoryChange: setCategory,
    onConcernChange: setConcern,
    onFormChange: setForm,
    onSortChange: setSort,
    onPriceApply: setPrice,
    onSearch: setQuery,
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 mt-6 lg:mt-0">
      {/* Mobile filter drawer toggle + drawer */}
      <div className="lg:col-span-12 lg:hidden">
        <ShopFilterDrawer {...panelProps} />
      </div>

      {/* Sticky sidebar (desktop) */}
      <aside className="hidden lg:block lg:col-span-3">
        <div className="shop-filter-sidebar">
          <ShopFilterPanel {...panelProps} />
        </div>
      </aside>

      {/* Product area */}
      <div className="lg:col-span-9">
        <ResultsStatusBar count={filtered.length} query={state.q} />
        <ShopProductMesh products={filtered} tenantSlug={tenantSlug} />
      </div>
    </div>
  );
}
