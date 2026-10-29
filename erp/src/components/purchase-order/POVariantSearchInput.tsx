'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useQuery } from '@tanstack/react-query';

import { Input } from '@/components/ui/input';
import { formatRupee } from '@/lib/format';
import { useDropdownAnchor, dropdownPanelStyle } from '@/hooks/useDropdownAnchor';

import { poQueryKeys } from './poQueryKeys';

/**
 * Debounced variant search used by each order line.
 *
 * Owns its own dropdown state so the line editor only hears about a completed
 * selection — the query string never reaches the form.
 *
 * The result list is rendered through a portal because the order-line card uses
 * `overflow-hidden`: an inline dropdown was both clipped by the card and pushed
 * off the bottom of the viewport once the view scrolled.
 */

export interface VariantSearchResult {
  id: string;
  sku: string;
  form?: string | null;
  packSize?: string | null;
  costPrice: string | number;
  stockQuantity: number;
  product: { name: string };
}

export function variantLabel(variant: {
  product: { name: string };
  form?: string | null;
  packSize?: string | null;
}): string {
  const parts = [variant.product.name];
  if (variant.form) parts.push(variant.form);
  if (variant.packSize) parts.push(variant.packSize);
  return parts.join(' – ');
}

interface POVariantSearchInputProps {
  lineNumber: number;
  onSelect: (variant: VariantSearchResult) => void;
  disabled?: boolean | undefined;
}

export function POVariantSearchInput({
  lineNumber,
  onSelect,
  disabled,
}: POVariantSearchInputProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { setAnchor, rect, measure } = useDropdownAnchor(open);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data } = useQuery<{ success: boolean; data: VariantSearchResult[] }>({
    queryKey: poQueryKeys.variantSearch(debouncedSearch),
    queryFn: () =>
      fetch(`/api/store/variants/search?search=${encodeURIComponent(debouncedSearch)}`).then((r) =>
        r.json(),
      ),
    enabled: debouncedSearch.length >= 1,
  });

  const results = data?.data ?? [];

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as Node;
      // The panel lives in a portal, so it is outside containerRef.
      if (panelRef.current?.contains(target)) return;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSelect = useCallback(
    (variant: VariantSearchResult) => {
      onSelect(variant);
      setSearch('');
      setDebouncedSearch('');
      setOpen(false);
    },
    [onSelect],
  );

  const showPanel = open && results.length > 0 && rect !== null;

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={setAnchor}
        placeholder={`Search product or SKU for line ${lineNumber}…`}
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          // The page may have scrolled while the panel was closed, so refresh
          // the anchor before opening rather than trusting the stale rect.
          measure();
          setOpen(true);
        }}
        onFocus={() => {
          if (search.length > 0) {
            measure();
            setOpen(true);
          }
        }}
        disabled={disabled}
      />
      {showPanel &&
        rect &&
        createPortal(
          <div
            ref={panelRef}
            className="z-[9999] overflow-y-auto rounded-lg border border-sand/30 bg-pearl shadow-lg"
            style={{ ...dropdownPanelStyle(rect), maxHeight: rect.maxHeight }}
          >
            {results.map((variant) => (
              <button
                key={variant.id}
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-linen"
                onClick={() => handleSelect(variant)}
              >
                <div>
                  <p className="font-medium text-espresso">{variantLabel(variant)}</p>
                  <p className="text-xs text-mist">
                    SKU: {variant.sku} · Stock: {variant.stockQuantity}
                  </p>
                </div>
                <span className="font-mono text-xs text-mist">{formatRupee(variant.costPrice)}</span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
