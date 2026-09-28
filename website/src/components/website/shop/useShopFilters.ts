'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PublicProduct } from '@/types/website.types';

export interface ShopFilterState {
  category?: string;
  sort?: string;
  priceMin?: number;
  priceMax?: number;
  concern?: string;
  form?: string;
  q?: string;
}
interface UseShopFiltersOptions {
  /** Slug of the current tenant (used to build the canonical path). */
  initial: ShopFilterState;
  products: PublicProduct[];
  onQueryChange?: (state: ShopFilterState) => void;
}
/** The lowest variant retail price for a product. */
function productPrice(p: PublicProduct): number {
  return p.variants?.[0]?.retailPrice ?? p.primaryVariant?.retailPrice ?? 0;
}

/**
 * Client-side shop filter state.
 *
 * All filters are held in local React state (so applying one is instant — no
 * page reload, no scroll reset) and mirrored to the URL query string via
 * `history.replaceState` so the state is shareable / deep-linkable. The full
 * catalog is filtered in-memory, which is fine because the storefront catalog
 * is small (dozens of rows).
 */
export function useShopFilters({ initial, products, onQueryChange }: UseShopFiltersOptions) {
  const [state, setState] = useState<ShopFilterState>(initial);

  // Mirror the state to the URL (replace, not push) without triggering a
  // navigation. This keeps the browser URL informative while the user stays
  // exactly where they are on the page.
  useEffect(() => {
    const params = new URLSearchParams();
    if (state.category) params.set('category', state.category);
    if (state.sort && state.sort !== 'latest') params.set('sort', state.sort);
    if (state.priceMin !== undefined) params.set('priceMin', String(state.priceMin));
    if (state.priceMax !== undefined) params.set('priceMax', String(state.priceMax));
    if (state.concern) params.set('concern', state.concern);
    if (state.form) params.set('form', state.form);
    if (state.q) params.set('q', state.q);

    const query = params.toString();
    const base = window.location.pathname;
    const url = `${base}${query ? `?${query}` : ''}`;
    window.history.replaceState({ ...window.history.state, shop: state }, '', url);
    onQueryChange?.(state);
  }, [state, onQueryChange]);

  const filtered = useMemo(() => {
    let list = products;
    if (state.q) {
      const needle = state.q.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          p.description?.toLowerCase().includes(needle) ||
          p.tags.some((t) => t.toLowerCase().includes(needle)),
      );
    }
    if (state.category) {
      list = list.filter((p) => p.categoryId === state.category);
    }
    if (state.concern) {
      list = list.filter((p) => p.healthConcerns.includes(state.concern as string));
    }
    if (state.form) {
      list = list.filter((p) => p.variants.some((v) => v.form === state.form));
    }
    if (state.priceMin !== undefined) {
      list = list.filter((p) => productPrice(p) >= (state.priceMin as number));
    }
    if (state.priceMax !== undefined) {
      list = list.filter((p) => productPrice(p) <= (state.priceMax as number));
    }
    if (state.sort && state.sort !== 'latest') {
      list = [...list].sort((a, b) => {
        if (state.sort === 'price-asc') return productPrice(a) - productPrice(b);
        if (state.sort === 'price-desc') return productPrice(b) - productPrice(a);
        return 0; // best-selling / featured: preserve catalog order
      });
    }
    return list;
  }, [products, state]);

  const setCategory = useCallback((value?: string) => {
    setState((s) => {
      const next = { ...s };
      if (value) next.category = value;
      else delete next.category;
      return next;
    });
  }, []);
  const setConcern = useCallback((value?: string) => {
    setState((s) => {
      const next = { ...s };
      if (value) next.concern = value;
      else delete next.concern;
      return next;
    });
  }, []);
  const setForm = useCallback((value?: string) => {
    setState((s) => {
      const next = { ...s };
      if (value) next.form = value;
      else delete next.form;
      return next;
    });
  }, []);
  const setSort = useCallback((value: string) => {
    setState((s) => ({ ...s, sort: value }));
  }, []);
  const setPrice = useCallback((min?: number, max?: number) => {
    setState((s) => {
      const next = { ...s };
      if (min !== undefined) next.priceMin = min;
      else delete next.priceMin;
      if (max !== undefined) next.priceMax = max;
      else delete next.priceMax;
      return next;
    });
  }, []);
  const setQuery = useCallback((value: string) => {
    setState((s) => ({ ...s, q: value }));
  }, []);

  return {
    state,
    filtered,
    setCategory,
    setConcern,
    setForm,
    setSort,
    setPrice,
    setQuery,
  };
}
