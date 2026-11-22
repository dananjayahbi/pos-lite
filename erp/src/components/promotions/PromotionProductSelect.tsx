'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ProductOption {
  id: string;
  name: string;
}

interface PromotionProductSelectProps {
  id?: string;
  value: string | undefined;
  onChange: (productId: string) => void;
  /** Label for the current edit value when it is outside the first results. */
  selectedLabel?: string | undefined;
  placeholder: string;
  disabled?: boolean;
}

const SEARCH_LIMIT = 25;

/**
 * Searchable product picker for promotions (ARGUS #334).
 *
 * The page used to fetch `/products?limit=1000` once and filter in memory, so
 * product #1001 was unselectable. This picker searches server-side on every
 * debounced term and always keeps the current selection visible.
 */
export function PromotionProductSelect({
  id,
  value,
  onChange,
  selectedLabel,
  placeholder,
  disabled = false,
}: PromotionProductSelectProps) {
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [label, setLabel] = useState(selectedLabel ?? '');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLabel(selectedLabel ?? '');
  }, [selectedLabel]);

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(async () => {
      setIsLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({
          status: 'active',
          limit: String(SEARCH_LIMIT),
        });
        const term = search.trim();
        if (term) params.set('search', term);
        const res = await fetch(`/api/store/products?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to search products');
        const json = await res.json();
        if (!cancelled) setOptions((json.data ?? []) as ProductOption[]);
      } catch {
        if (!cancelled) {
          setOptions([]);
          setError('Products could not be loaded. Type a search term to retry.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  const selectedMissing = Boolean(value && !options.some((option) => option.id === value));

  return (
    <div className="space-y-1.5">
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search products..."
        aria-label="Search products for this promotion"
        className="h-8 font-body text-sm"
        disabled={disabled}
      />
      <Select
        value={value ?? ''}
        onValueChange={(next) => {
          const found = options.find((option) => option.id === next);
          setLabel(found?.name ?? '');
          onChange(next);
        }}
        disabled={disabled}
      >
        <SelectTrigger id={id} className="font-body" aria-label={placeholder}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {selectedMissing && value && (
            <SelectItem value={value}>{label || 'Selected product'}</SelectItem>
          )}
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id} className="font-body">
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isLoading ? (
        <p className="font-body text-[11px] text-mist-ink" aria-live="polite">
          Searching products…
        </p>
      ) : error ? (
        <p className="font-body text-[11px] text-[#9B2226]" role="alert">
          {error}
        </p>
      ) : options.length === 0 ? (
        <p className="font-body text-[11px] text-mist-ink">
          No active products match this search.
        </p>
      ) : null}
    </div>
  );
}
