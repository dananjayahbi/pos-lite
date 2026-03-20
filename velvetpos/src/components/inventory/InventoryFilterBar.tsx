'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, X, Filter, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { useCategories } from '@/hooks/useCategories';
import { useBrands } from '@/hooks/useBrands';
import { mergeSearchParams } from '@/lib/urlUtils';

// ── Gender & Status constants ────────────────────────────────────────────────

const GENDERS = [
  { value: 'MEN', label: 'Men' },
  { value: 'WOMEN', label: 'Women' },
  { value: 'UNISEX', label: 'Unisex' },
  { value: 'KIDS', label: 'Kids' },
  { value: 'TODDLERS', label: 'Toddlers' },
] as const;

const STATUSES = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
  { value: 'low_stock', label: 'Low Stock' },
  { value: 'out_of_stock', label: 'Out of Stock' },
] as const;

// ── Props ────────────────────────────────────────────────────────────────────

interface InventoryFilterBarProps {
  totalCount: number;
}

// ── Component ────────────────────────────────────────────────────────────────

export function InventoryFilterBar({ totalCount }: InventoryFilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filtersExpanded, setFiltersExpanded] = useState(true);

  // Search state
  const searchValue = searchParams.get('search') ?? '';
  const [localSearch, setLocalSearch] = useState(searchValue);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Sync local search with URL
  useEffect(() => {
    setLocalSearch(searchParams.get('search') ?? '');
  }, [searchParams]);

  // Debounced search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const currentSearch = searchParams.get('search') ?? '';
      if (localSearch !== currentSearch) {
        const merged = mergeSearchParams(searchParams, {
          search: localSearch || null,
          page: '1',
        });
        router.push(`/inventory?${merged}`);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [localSearch, searchParams, router]);

  // Active filter values
  const activeCategories = searchParams.get('categories')?.split(',').filter(Boolean) ?? [];
  const activeBrands = searchParams.get('brands')?.split(',').filter(Boolean) ?? [];
  const activeGenders = searchParams.get('genders')?.split(',').filter(Boolean) ?? [];
  const activeStatus = searchParams.get('status') ?? '';

  // Filter count
  const filterCount =
    activeCategories.length +
    activeBrands.length +
    activeGenders.length +
    (activeStatus ? 1 : 0);

  // Bi-modal font for search
  const isSkuLike = localSearch.length >= 8 && !localSearch.includes(' ');

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist" />
        <Input
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Search by name, SKU, or barcode…"
          className={`border-sand bg-linen pl-10 pr-10 text-espresso placeholder:text-mist focus:bg-pearl ${
            isSkuLike ? 'font-mono' : 'font-body'
          }`}
        />
        {localSearch && (
          <button
            type="button"
            onClick={() => setLocalSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-terracotta hover:text-espresso transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filter bar */}
      {filtersExpanded && (
        <div className="flex flex-wrap items-center gap-2">
          <CategoryFilterPopover
            activeIds={activeCategories}
            onChange={(ids) => {
              const merged = mergeSearchParams(searchParams, {
                categories: ids.length > 0 ? ids.join(',') : null,
                page: '1',
              });
              router.push(`/inventory?${merged}`);
            }}
          />

          <BrandFilterPopover
            activeIds={activeBrands}
            onChange={(ids) => {
              const merged = mergeSearchParams(searchParams, {
                brands: ids.length > 0 ? ids.join(',') : null,
                page: '1',
              });
              router.push(`/inventory?${merged}`);
            }}
          />

          <div className="mx-1 h-6 w-px bg-sand/50" />

          {/* Gender chips */}
          {GENDERS.map((g) => {
            const isActive = activeGenders.includes(g.value);
            return (
              <button
                key={g.value}
                type="button"
                onClick={() => {
                  const next = isActive
                    ? activeGenders.filter((v) => v !== g.value)
                    : [...activeGenders, g.value];
                  const merged = mergeSearchParams(searchParams, {
                    genders: next.length > 0 ? next.join(',') : null,
                    page: '1',
                  });
                  router.push(`/inventory?${merged}`);
                }}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-espresso text-pearl'
                    : 'border border-sand text-espresso hover:bg-sand/10'
                }`}
              >
                {g.label}
              </button>
            );
          })}

          <div className="mx-1 h-6 w-px bg-sand/50" />

          {/* Status chips */}
          {STATUSES.map((s) => {
            const isActive = activeStatus === s.value;
            const chipClass =
              isActive && s.value === 'low_stock'
                ? 'bg-espresso text-[#B7791F]'
                : isActive && s.value === 'out_of_stock'
                  ? 'bg-espresso text-red-300'
                  : isActive
                    ? 'bg-espresso text-pearl'
                    : 'border border-sand text-espresso hover:bg-sand/10';

            return (
              <button
                key={s.value}
                type="button"
                onClick={() => {
                  const merged = mergeSearchParams(searchParams, {
                    status: s.value || null,
                    page: '1',
                  });
                  router.push(`/inventory?${merged}`);
                }}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${chipClass}`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Filters toggle */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className="border-sand text-espresso gap-1.5"
          onClick={() => setFiltersExpanded(!filtersExpanded)}
        >
          <Filter className="h-3.5 w-3.5" />
          Filters
          {filterCount > 0 && (
            <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-espresso px-1.5 text-[10px] font-semibold text-pearl">
              {filterCount}
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}

// ── Category Filter Popover ──────────────────────────────────────────────────

interface FilterPopoverProps {
  activeIds: string[];
  onChange: (ids: string[]) => void;
}

function CategoryFilterPopover({ activeIds, onChange }: FilterPopoverProps) {
  const { data } = useCategories();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const categories = data?.data ?? [];

  // Build tree: top-level then children indented
  const tree = useMemo(() => {
    const topLevel = categories.filter((c) => !c.parentId);
    const result: Array<{ id: string; name: string; depth: number }> = [];
    for (const parent of topLevel) {
      result.push({ id: parent.id, name: parent.name, depth: 0 });
      const children = categories.filter((c) => c.parentId === parent.id);
      for (const child of children) {
        result.push({ id: child.id, name: child.name, depth: 1 });
      }
    }
    return result;
  }, [categories]);

  const filtered = search
    ? tree.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : tree;

  const toggleId = (id: string) => {
    onChange(
      activeIds.includes(id)
        ? activeIds.filter((v) => v !== id)
        : [...activeIds, id],
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="border-sand text-espresso">
          Category{activeIds.length > 0 ? `: ${activeIds.length}` : ''}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <div className="p-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories…"
            className="border-sand bg-pearl text-sm font-body"
          />
        </div>
        <div className="max-h-60 overflow-y-auto px-1 pb-2">
          {filtered.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-mist font-body">
              No categories found
            </p>
          )}
          {filtered.map((c) => (
            <label
              key={c.id}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-sand/10"
              style={{ paddingLeft: c.depth > 0 ? '2rem' : undefined }}
            >
              {c.depth > 0 && (
                <ChevronRight className="h-3 w-3 text-mist -ml-3" />
              )}
              <Checkbox
                checked={activeIds.includes(c.id)}
                onCheckedChange={() => toggleId(c.id)}
              />
              <span className="text-sm font-body text-espresso">{c.name}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Brand Filter Popover ─────────────────────────────────────────────────────

function BrandFilterPopover({ activeIds, onChange }: FilterPopoverProps) {
  const { data } = useBrands();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const brands = data?.data ?? [];

  const filtered = search
    ? brands.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()))
    : brands;

  const toggleId = (id: string) => {
    onChange(
      activeIds.includes(id)
        ? activeIds.filter((v) => v !== id)
        : [...activeIds, id],
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="border-sand text-espresso">
          Brand{activeIds.length > 0 ? `: ${activeIds.length}` : ''}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <div className="p-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search brands…"
            className="border-sand bg-pearl text-sm font-body"
          />
        </div>
        <div className="max-h-60 overflow-y-auto px-1 pb-2">
          {filtered.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-mist font-body">
              No brands found
            </p>
          )}
          {filtered.map((b) => (
            <label
              key={b.id}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-sand/10"
            >
              <Checkbox
                checked={activeIds.includes(b.id)}
                onCheckedChange={() => toggleId(b.id)}
              />
              <span className="text-sm font-body text-espresso">{b.name}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
