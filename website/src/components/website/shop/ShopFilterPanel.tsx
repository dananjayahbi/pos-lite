'use client';

import React from 'react';
import { X } from 'lucide-react';
import type { PublicCategory, PublicConcern } from '@/types/website.types';
import { ShopSearchInput } from './ShopSearchInput';
import { PriceRangeFilter } from './PriceRangeFilter';
import { SortSelect } from './SortSelect';
import { FilterCollapsible } from './FilterCollapsible';
import { FilterPillRow } from './FilterPillRow';

interface ShopFilterPanelProps {
  categories: PublicCategory[];
  concerns: PublicConcern[];
  forms: string[];
  tenantSlug: string;
  selectedCategory?: string | undefined;
  selectedConcern?: string | undefined;
  selectedForm?: string | undefined;
  selectedSort?: string | undefined;
  priceMin?: number | undefined;
  priceMax?: number | undefined;
  priceBounds: { min: number; max: number };
  /** When true, render inside the mobile slide-in drawer with a close button. */
  isDrawer?: boolean;
  onClose?: () => void;
  /** Controlled setters — each updates the client-side filter state. */
  onCategoryChange?: (value?: string) => void;
  onConcernChange?: (value?: string) => void;
  onFormChange?: (value?: string) => void;
  onSortChange?: (value: string) => void;
  onPriceApply?: (min?: number, max?: number) => void;
  /** Keyword search navigation (routes to the shop page with ?q=). */
  onSearch?: (q: string) => void;
}

export type { ShopFilterPanelProps };

/**
 * Shop filter sidebar. On desktop it sits as a sticky left column; on mobile
 * it is toggled through a slide-in drawer (`isDrawer`). The panel is fully
 * controlled: the parent supplies the active values and the change handlers
 * that update the client-side filter state (no navigation, no reload).
 */
export function ShopFilterPanel({
  categories,
  concerns,
  forms,
  tenantSlug,
  selectedCategory,
  selectedConcern,
  selectedForm,
  selectedSort,
  priceMin,
  priceMax,
  priceBounds,
  isDrawer = false,
  onClose,
  onCategoryChange,
  onConcernChange,
  onFormChange,
  onSortChange,
  onPriceApply,
  onSearch,
}: ShopFilterPanelProps) {
  return (
    <div className="shop-filter-panel">
      {/* Header (drawer only) */}
      {isDrawer && (
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
          <span className="text-sm font-semibold uppercase tracking-wider text-white">Filters</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="rounded-full border border-white/15 p-2 text-[#cbd5e1] transition-colors hover:border-[#97c93e]/50 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="space-y-5">
        {/* Search */}
        <div>
          <ShopSearchInput
            tenantSlug={tenantSlug}
            {...(onSearch ? { onSearch } : {})}
          />
        </div>

        {/* Sort */}
        <div>
          <SortSelect value={selectedSort} onChange={(value) => onSortChange?.(value)} />
        </div>

        {/* Price */}
        <FilterCollapsible title="Price">
          <PriceRangeFilter
            bounds={priceBounds}
            valueMin={priceMin}
            valueMax={priceMax}
            onApply={(min, max) => onPriceApply?.(min, max)}
          />
        </FilterCollapsible>

        {/* Category */}
        {categories.length > 0 && (
          <FilterCollapsible title="Category">
            <FilterPillRow
              options={categories.map((c) => ({ id: c.id, label: c.name }))}
              selectedId={selectedCategory}
              onSelect={(id) => {
                onCategoryChange?.(id);
                onClose?.();
              }}
            />
          </FilterCollapsible>
        )}

        {/* Concern */}
        {concerns.length > 0 && (
          <FilterCollapsible title="Concern" defaultOpen={false}>
            <FilterPillRow
              options={concerns.map((c) => ({ id: c.value, label: c.label }))}
              selectedId={selectedConcern}
              onSelect={(id) => {
                onConcernChange?.(id);
                onClose?.();
              }}
            />
          </FilterCollapsible>
        )}

        {/* Form */}
        {forms.length > 0 && (
          <FilterCollapsible title="Type" defaultOpen={false}>
            <FilterPillRow
              options={forms.map((f) => ({ id: f, label: f }))}
              selectedId={selectedForm}
              onSelect={(id) => {
                onFormChange?.(id);
                onClose?.();
              }}
            />
          </FilterCollapsible>
        )}
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-xl border border-[#97c93e]/40 bg-[#97c93e]/10 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#97c93e] transition-colors hover:bg-[#97c93e] hover:text-[#051610]"
        >
          Close Filters
        </button>
      )}
    </div>
  );
}
