'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';
import { useBrands } from '@/hooks/useBrands';
import { mergeSearchParams } from '@/lib/urlUtils';

const GENDER_LABELS: Record<string, string> = {
  MEN: 'Men',
  WOMEN: 'Women',
  UNISEX: 'Unisex',
  KIDS: 'Kids',
  TODDLERS: 'Toddlers',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  archived: 'Archived',
  low_stock: 'Low Stock',
  out_of_stock: 'Out of Stock',
};

export function ActiveFilterChips() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { data: catData } = useCategories();
  const { data: brandData } = useBrands();

  const activeCategories = searchParams.get('categories')?.split(',').filter(Boolean) ?? [];
  const activeBrands = searchParams.get('brands')?.split(',').filter(Boolean) ?? [];
  const activeGenders = searchParams.get('genders')?.split(',').filter(Boolean) ?? [];
  const activeStatus = searchParams.get('status') ?? '';

  const categories = catData?.data ?? [];
  const brands = brandData?.data ?? [];

  const hasFilters =
    activeCategories.length > 0 ||
    activeBrands.length > 0 ||
    activeGenders.length > 0 ||
    !!activeStatus;

  if (!hasFilters) return null;

  const removeFilter = (param: string, value?: string) => {
    if (value) {
      const current = searchParams.get(param)?.split(',').filter(Boolean) ?? [];
      const next = current.filter((v) => v !== value);
      const merged = mergeSearchParams(searchParams, {
        [param]: next.length > 0 ? next.join(',') : null,
        page: '1',
      });
      router.push(`/inventory?${merged}`);
    } else {
      const merged = mergeSearchParams(searchParams, {
        [param]: null,
        page: '1',
      });
      router.push(`/inventory?${merged}`);
    }
  };

  const clearAll = () => {
    const merged = mergeSearchParams(searchParams, {
      categories: null,
      brands: null,
      genders: null,
      status: null,
      page: '1',
    });
    router.push(`/inventory?${merged}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {activeCategories.map((id) => {
        const cat = categories.find((c) => c.id === id);
        return (
          <Chip
            key={`cat-${id}`}
            label={cat?.name ?? id}
            group="Category"
            onRemove={() => removeFilter('categories', id)}
          />
        );
      })}

      {activeBrands.map((id) => {
        const brand = brands.find((b) => b.id === id);
        return (
          <Chip
            key={`brand-${id}`}
            label={brand?.name ?? id}
            group="Brand"
            onRemove={() => removeFilter('brands', id)}
          />
        );
      })}

      {activeGenders.map((g) => (
        <Chip
          key={`gender-${g}`}
          label={GENDER_LABELS[g] ?? g}
          group="Gender"
          onRemove={() => removeFilter('genders', g)}
        />
      ))}

      {activeStatus && (
        <Chip
          label={STATUS_LABELS[activeStatus] ?? activeStatus}
          group="Status"
          onRemove={() => removeFilter('status')}
        />
      )}

      <button
        type="button"
        onClick={clearAll}
        className="ml-1 text-xs font-medium text-terracotta hover:text-espresso transition-colors"
      >
        Clear all
      </button>
    </div>
  );
}

// ── Chip ─────────────────────────────────────────────────────────────────────

function Chip({
  label,
  group,
  onRemove,
}: {
  label: string;
  group: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-sand bg-pearl px-2.5 py-0.5 text-xs text-espresso font-body">
      <span className="text-mist">{group}:</span>
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 rounded-full p-0.5 hover:bg-sand/20 transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
