'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogOverlay,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  SearchIcon,
  FileTextIcon,
  MousePointerClickIcon,
  CornerDownLeftIcon,
  XIcon,
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import {
  NAV_SEARCH_INDEX,
  groupNavEntries,
  type NavSearchEntry,
} from '@/lib/navigation/search-index';

interface NavSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optionally close the parent sheet/drawer when navigating. */
  onNavigate?: () => void;
}

function matchesQuery(
  entry: NavSearchEntry,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    entry.title,
    entry.description ?? '',
    entry.group ?? '',
    ...(entry.keywords ?? []),
  ]
    .join(' ')
    .toLowerCase();
  // Split query into tokens; every token must appear somewhere.
  return q.split(/\s+/).filter(Boolean).every((token) => haystack.includes(token));
}

export default function NavSearchModal({
  open,
  onOpenChange,
  onNavigate,
}: NavSearchModalProps) {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const visibleEntries = useMemo(() => {
    return NAV_SEARCH_INDEX.filter(
      (entry) => !entry.permission || hasPermission(entry.permission),
    );
  }, [hasPermission]);

  const filtered = useMemo(
    () => visibleEntries.filter((entry) => matchesQuery(entry, query)),
    [visibleEntries, query],
  );

  const grouped = useMemo(() => groupNavEntries(filtered), [filtered]);

  // When the modal opens, reset the query and focus the input.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(t);
  }, [open]);

  const resetState = useCallback(() => {
    setQuery('');
    setActiveIndex(0);
  }, []);

  // Handle open/close from the Dialog. When opening, reset stale state.
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) resetState();
      onOpenChange(next);
    },
    [onOpenChange, resetState],
  );

  const goTo = useCallback(
    (entry: NavSearchEntry) => {
      onOpenChange(false);
      onNavigate?.();
      router.push(entry.path);
    },
    [onOpenChange, onNavigate, router],
  );

  const flatIndex = useMemo(() => filtered, [filtered]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!flatIndex.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % flatIndex.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + flatIndex.length) % flatIndex.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const entry = flatIndex[activeIndex];
      if (entry) goTo(entry);
    }
  }

  // Keep the active item scrolled into view.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, grouped]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogOverlay className="bg-espresso/40 backdrop-blur-md" />
      <DialogContent
        showCloseButton={false}
        className="fixed top-[18vh] left-1/2 z-50 w-full max-w-xl -translate-x-1/2 translate-y-0 gap-0 overflow-hidden rounded-2xl border border-mist bg-pearl p-0 shadow-2xl outline-none sm:max-w-lg"
      >
        <DialogTitle className="sr-only">Search pages and actions</DialogTitle>

        {/* ── Search input ── */}
        <div
          className="flex items-center gap-2 border-b border-mist px-4"
          onKeyDown={handleKeyDown}
        >
          <SearchIcon className="h-4 w-4 shrink-0 text-sand" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Search pages and actions…"
            className="h-12 border-0 bg-transparent px-0 shadow-none text-base placeholder:text-sand/70 focus-visible:ring-0"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQuery('');
                setActiveIndex(0);
              }}
              className="text-sand hover:text-espresso"
            >
              <XIcon className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="hidden rounded border border-mist bg-linen px-1.5 py-0.5 text-[10px] text-sand sm:inline">
              ESC
            </kbd>
          )}
        </div>

        {/* ── Results ── */}
        <div
          ref={listRef}
          className="max-h-[55vh] overflow-y-auto scrollbar-none p-2"
        >
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 py-12 text-center">
              <SearchIcon className="h-6 w-6 text-sand/60" />
              <p className="text-sm text-espresso/70">No results found</p>
              <p className="text-xs text-sand">Try a different keyword.</p>
            </div>
          ) : (
            grouped.map(({ group, entries }) => {
              return (
                <div key={group} className="mb-2 last:mb-0">
                  <p className="text-sand/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider">
                    {group}
                  </p>
                  {entries.map((entry) => {
                    const flatPos = flatIndex.findIndex((e) => e === entry);
                    const isActive = flatPos === activeIndex;
                    return (
                      <button
                        key={`${entry.path}-${entry.title}`}
                        type="button"
                        data-active={isActive ? 'true' : 'false'}
                        onClick={() => goTo(entry)}
                        onMouseEnter={() => setActiveIndex(flatPos)}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                          isActive ? 'bg-linen text-espresso' : 'text-espresso/80'
                        }`}
                      >
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${
                            isActive ? 'border-terracotta bg-pearl text-terracotta' : 'border-mist bg-pearl text-sand'
                          }`}
                        >
                          {entry.kind === 'action' ? (
                            <MousePointerClickIcon className="h-4 w-4" />
                          ) : (
                            <FileTextIcon className="h-4 w-4" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{entry.title}</span>
                          {entry.description ? (
                            <span className="block truncate text-xs text-sand">
                              {entry.description}
                            </span>
                          ) : null}
                        </span>
                        {isActive ? (
                          <CornerDownLeftIcon className="h-3.5 w-3.5 shrink-0 text-terracotta" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* ── Footer / shortcut hints ── */}
        <div className="flex items-center gap-3 border-t border-mist bg-linen/40 px-4 py-2 text-[11px] text-sand">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-mist bg-pearl px-1 py-0.5">↑↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-mist bg-pearl px-1 py-0.5">↵</kbd>
            open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-mist bg-pearl px-1 py-0.5">ESC</kbd>
            close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
