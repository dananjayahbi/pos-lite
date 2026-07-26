'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Check, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

interface ProductOption {
  id: string;
  name: string;
  primaryVariant: {
    id: string;
    imageUrls: string[];
    retailPrice: number;
  } | null;
}

export interface ProductPickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  max?: number;
}

// ── Format LKR ───────────────────────────────────────────────────────────────

function formatLKR(amount: number): string {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ── Debounce hook ────────────────────────────────────────────────────────────

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

// ── Component ────────────────────────────────────────────────────────────────

export function ProductPicker({ selectedIds, onChange, max = 7 }: ProductPickerProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<ProductOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<ProductOption[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebouncedValue(search, 300);

  // ── Fetch results on debounced search ────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function fetchProducts() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ limit: '20' });
        if (debouncedSearch) params.set('search', debouncedSearch);

        const res = await fetch(`/api/store/website/products?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch products');

        const json = await res.json();
        if (!cancelled) {
          setResults((json.data?.products as ProductOption[]) ?? []);
        }
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchProducts();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  // ── Fetch selected product details when IDs change ──────────────────────

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // When selected IDs change from outside, merge with local cache
  useEffect(() => {
    setSelectedProducts((prev) =>
      prev.filter((p) => selectedIdSet.has(p.id)),
    );
  }, [selectedIdSet]);

  // ── Click outside / Escape ──────────────────────────────────────────────

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // ── Toggle product selection ────────────────────────────────────────────

  const toggleProduct = useCallback(
    (product: ProductOption) => {
      const isSelected = selectedIdSet.has(product.id);

      if (isSelected) {
        onChange(selectedIds.filter((id) => id !== product.id));
        setSelectedProducts((prev) => prev.filter((p) => p.id !== product.id));
      } else {
        if (selectedIds.length >= max) return;
        onChange([...selectedIds, product.id]);
        setSelectedProducts((prev) => {
          if (prev.some((p) => p.id === product.id)) return prev;
          return [...prev, product];
        });
      }
    },
    [selectedIds, selectedIdSet, onChange, max],
  );

  const removeProduct = useCallback(
    (id: string) => {
      onChange(selectedIds.filter((pid) => pid !== id));
      setSelectedProducts((prev) => prev.filter((p) => p.id !== id));
    },
    [selectedIds, onChange],
  );

  // ── Memoize filtered results ────────────────────────────────────────────

  const filteredResults = useMemo(
    () => results.filter((r) => !selectedIdSet.has(r.id)),
    [results, selectedIdSet],
  );

  const atMax = selectedIds.length >= max;

  // ── Dropdown position (fixed via portal) ────────────────────────────────

  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, [isOpen]);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div ref={containerRef} className="relative">
      {/* Label + count */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-sand">Select Products</span>
        <span className="text-xs text-sand">
          {selectedIds.length} / {max} selected
        </span>
      </div>

      {/* Selected chips */}
      {selectedProducts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedProducts.map((product) => (
            <span
              key={product.id}
              className="inline-flex items-center gap-1 rounded-md border border-mist bg-cream/40 px-2 py-0.5 text-xs text-espresso"
            >
              <span className="max-w-35 truncate">{product.name}</span>
              <button
                type="button"
                className="ml-0.5 rounded-full p-0.5 text-sand hover:bg-mist hover:text-red-500 transition-colors"
                onClick={() => removeProduct(product.id)}
                aria-label={`Remove ${product.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sand" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search products by name or SKU..."
          className="h-9 pl-8 text-sm"
        />
      </div>

      {/* Dropdown via portal — escapes overflow-hidden ancestors */}
      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[9999] mt-1 rounded-lg border border-mist bg-white shadow-lg"
            style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
          >
            <div className="max-h-64 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center px-4 py-8">
                  <span className="text-xs text-sand animate-pulse">Searching products...</span>
                </div>
              ) : results.length === 0 ? (
                <div className="flex items-center justify-center px-4 py-8">
                  <span className="text-xs text-sand">
                    {debouncedSearch ? 'No products found' : 'Type to search products'}
                  </span>
                </div>
              ) : (
                <>
                  {/* Already selected (shown at top, with check) */}
                  {results
                    .filter((r) => selectedIdSet.has(r.id))
                    .map((product) => (
                      <div
                        key={product.id}
                        role="button"
                        tabIndex={0}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-cream/30 transition-colors cursor-pointer"
                        onClick={() => toggleProduct(product)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleProduct(product);
                          }
                        }}
                      >
                        <Checkbox checked disabled={false} className="pointer-events-none" />
                        <div className="flex-1 min-w-0">
                          <span className="block truncate text-espresso font-medium">
                            {product.name}
                          </span>
                        </div>
                        {product.primaryVariant && (
                          <span className="shrink-0 text-xs text-sand">
                            {formatLKR(product.primaryVariant.retailPrice)}
                          </span>
                        )}
                      </div>
                    ))}

                  {/* Divider */}
                  {results.some((r) => selectedIdSet.has(r.id)) &&
                    filteredResults.length > 0 && (
                      <div className="border-t border-mist" />
                    )}

                  {/* Unselected results */}
                  {filteredResults.map((product) => (
                    <div
                      key={product.id}
                      role="button"
                      tabIndex={0}
                      className={cn(
                        'flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors',
                        atMax
                          ? 'cursor-not-allowed opacity-40'
                          : 'hover:bg-cream/30 cursor-pointer',
                      )}
                      onClick={() => toggleProduct(product)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleProduct(product);
                        }
                      }}
                    >
                      <Checkbox
                        checked={false}
                        disabled={atMax}
                        className="pointer-events-none"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="block truncate text-espresso">
                          {product.name}
                        </span>
                      </div>
                      {product.primaryVariant && (
                        <span className="shrink-0 text-xs text-sand">
                          {formatLKR(product.primaryVariant.retailPrice)}
                        </span>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Max hint */}
            {atMax && (
              <div className="border-t border-mist px-3 py-1.5">
                <p className="text-xs text-sand">Max {max} products selected</p>
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
