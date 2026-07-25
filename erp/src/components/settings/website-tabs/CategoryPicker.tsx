'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CategoryData {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
}

interface CategoryPickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  max?: number;
}

export function CategoryPicker({
  selectedIds,
  onChange,
  max = 5,
}: CategoryPickerProps) {
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchCategories() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/store/website/categories');
        if (!res.ok) throw new Error('Failed to fetch categories');
        const json = await res.json();
        if (!cancelled) {
          setCategories(json.data?.categories ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load categories',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchCategories();
    return () => {
      cancelled = true;
    };
  }, []);

  const isSelected = useCallback(
    (id: string) => selectedIds.includes(id),
    [selectedIds],
  );

  const isMaxReached = selectedIds.length >= max;

  function handleToggle(id: string) {
    if (isSelected(id)) {
      onChange(selectedIds.filter((sid) => sid !== id));
    } else if (!isMaxReached) {
      onChange([...selectedIds, id]);
    }
  }

  function handleRemove(id: string) {
    onChange(selectedIds.filter((sid) => sid !== id));
  }

  // ── Loading state ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-xs text-sand">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading categories&hellip;
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────
  if (error) {
    return (
      <p className="py-2 text-xs text-red-500">
        Failed to load categories: {error}
      </p>
    );
  }

  // ── Selected count ─────────────────────────────────────────────────────
  const selectedLabel = `${selectedIds.length} / ${max} selected`;

  return (
    <div className="space-y-3">
      {/* Selected chips */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedIds.map((id) => {
            const cat = categories.find((c) => c.id === id);
            return (
              <Badge
                key={id}
                variant="secondary"
                className="cursor-pointer gap-1 pr-1"
                onClick={() => handleRemove(id)}
              >
                {cat?.name ?? id}
                <X className="h-3 w-3" />
              </Badge>
            );
          })}
        </div>
      )}

      {/* Count + max hint */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-sand">{selectedLabel}</p>
        {isMaxReached && (
          <p className="text-xs text-amber-600">Max {max} categories</p>
        )}
      </div>

      {/* Category list grid */}
      {categories.length === 0 ? (
        <p className="text-xs text-sand italic py-2">
          No categories found. Create categories first.
        </p>
      ) : (
        <div className="border border-mist rounded-lg divide-y divide-mist overflow-hidden">
          {categories.map((cat) => {
            const checked = isSelected(cat.id);
            const disabled = !checked && isMaxReached;

            return (
              <label
                key={cat.id}
                className={cn(
                  'flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors hover:bg-cream/30',
                  disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent',
                )}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => handleToggle(cat.id)}
                  disabled={disabled}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-espresso truncate">{cat.name}</p>
                  {cat.description && (
                    <p className="text-xs text-sand truncate mt-0.5">
                      {cat.description}
                    </p>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
