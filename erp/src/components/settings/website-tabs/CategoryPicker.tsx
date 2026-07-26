'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Loader2, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

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

// ── Component ────────────────────────────────────────────────────────────────

export function CategoryPicker({
  selectedIds,
  onChange,
  max = 5,
}: CategoryPickerProps) {
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Fetch categories on mount ─────────────────────────────────────────────

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

  // ── Selected set ──────────────────────────────────────────────────────────

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const isMaxReached = selectedIds.length >= max;

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

  // ── Toggle category ───────────────────────────────────────────────────────

  const toggleCategory = useCallback(
    (id: string) => {
      if (selectedIdSet.has(id)) {
        onChange(selectedIds.filter((sid) => sid !== id));
      } else if (!isMaxReached) {
        onChange([...selectedIds, id]);
      }
    },
    [selectedIds, selectedIdSet, isMaxReached, onChange],
  );

  const removeCategory = useCallback(
    (id: string) => {
      onChange(selectedIds.filter((sid) => sid !== id));
    },
    [selectedIds, onChange],
  );

  // ── Filtered results ──────────────────────────────────────────────────────

  const filteredResults = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return categories;
    return categories.filter(
      (cat) =>
        cat.name.toLowerCase().includes(q) ||
        (cat.description && cat.description.toLowerCase().includes(q)),
    );
  }, [categories, search]);

  const selectedResults = useMemo(
    () => filteredResults.filter((cat) => selectedIdSet.has(cat.id)),
    [filteredResults, selectedIdSet],
  );

  const unselectedResults = useMemo(
    () => filteredResults.filter((cat) => !selectedIdSet.has(cat.id)),
    [filteredResults, selectedIdSet],
  );

  // ── Dropdown position (fixed via portal) ──────────────────────────────────

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

  // ── Loading / Error states ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-xs text-sand">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading categories&hellip;
      </div>
    );
  }

  if (error) {
    return (
      <p className="py-2 text-xs text-red-500">
        Failed to load categories: {error}
      </p>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div ref={containerRef} className="relative">
      {/* Selected chips */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedIds.map((id) => {
            const cat = categories.find((c) => c.id === id);
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-md border border-mist bg-cream/40 px-2 py-0.5 text-xs text-espresso"
              >
                <span className="max-w-35 truncate">{cat?.name ?? id}</span>
                <button
                  type="button"
                  className="ml-0.5 rounded-full p-0.5 text-sand hover:bg-mist hover:text-red-500 transition-colors"
                  onClick={() => removeCategory(id)}
                  aria-label={`Remove ${cat?.name ?? id}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Count + max hint */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-sand">
          {selectedIds.length} / {max} selected
        </span>
        {isMaxReached && (
          <span className="text-xs text-amber-600">Max {max} categories</span>
        )}
      </div>

      {/* Trigger input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sand" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={categories.length === 0 ? 'No categories found' : 'Search categories...'}
          className="h-9 pl-8 pr-8 text-sm"
          disabled={categories.length === 0}
        />
        <ChevronDown
          className={cn(
            'absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sand transition-transform',
            isOpen && 'rotate-180',
          )}
        />
      </div>

      {/* Dropdown via portal — escapes overflow-hidden ancestors */}
      {isOpen &&
        categories.length > 0 &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[9999] mt-1 rounded-lg border border-mist bg-white shadow-lg"
            style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
          >
            <div className="max-h-64 overflow-y-auto">
              {filteredResults.length === 0 ? (
                <div className="flex items-center justify-center px-4 py-6">
                  <span className="text-xs text-sand">No categories match</span>
                </div>
              ) : (
                <>
                  {/* Already selected (shown at top) */}
                  {selectedResults.map((cat) => (
                    <div
                      key={cat.id}
                      role="button"
                      tabIndex={0}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-cream/30 transition-colors cursor-pointer"
                      onClick={() => toggleCategory(cat.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleCategory(cat.id);
                        }
                      }}
                    >
                      <Checkbox checked className="pointer-events-none" />
                      <div className="flex-1 min-w-0">
                        <span className="block truncate text-espresso font-medium">
                          {cat.name}
                        </span>
                        {cat.description && (
                          <span className="block truncate text-xs text-sand">
                            {cat.description}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  {selectedResults.length > 0 && unselectedResults.length > 0 && (
                    <div className="border-t border-mist" />
                  )}

                  {/* Unselected results */}
                  {unselectedResults.map((cat) => (
                    <div
                      key={cat.id}
                      role="button"
                      tabIndex={0}
                      className={cn(
                        'flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors',
                        isMaxReached
                          ? 'cursor-not-allowed opacity-40'
                          : 'hover:bg-cream/30 cursor-pointer',
                      )}
                      onClick={() => toggleCategory(cat.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleCategory(cat.id);
                        }
                      }}
                    >
                      <Checkbox checked={false} disabled={isMaxReached} className="pointer-events-none" />
                      <div className="flex-1 min-w-0">
                        <span className="block truncate text-espresso">
                          {cat.name}
                        </span>
                        {cat.description && (
                          <span className="block truncate text-xs text-sand">
                            {cat.description}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {isMaxReached && (
              <div className="border-t border-mist px-3 py-1.5">
                <p className="text-xs text-sand">Max {max} categories selected</p>
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
