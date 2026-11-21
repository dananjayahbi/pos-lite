'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  PackagePlus,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react';
import { toast } from 'sonner';
import { POSScanInput } from '@/components/pos/POSScanInput';
import { CartLineItems } from '@/components/pos/CartLineItems';
import { CartPanel } from '@/components/pos/CartPanel';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { usePOSProducts } from '@/hooks/usePOSProducts';
import { useBarcodeScanner, useBarcodeScanToCart } from '@/hooks/useBarcodeScanner';
import { useCartStore } from '@/stores/cartStore';
import { focusPOSBarcodeInput } from '@/lib/pos/keyboard';
import { formatRupee } from '@/lib/format';
import type { LankaQrSettings } from '@/lib/payments/lanka-qr-config';
import type { ProductListItem } from '@/hooks/useProducts';

type ProductVariant = NonNullable<ProductListItem['variants']>[number];

interface KeyboardPOSWorkspaceProps {
  shiftId: string;
  lankaQr?: LankaQrSettings | undefined;
}

interface ConsoleRow {
  key: string;
  product: ProductListItem;
  variant: ProductVariant;
}

interface ScanFeedback {
  type: 'success' | 'warning' | 'error';
  text: string;
}

const SEARCH_DEBOUNCE_MS = 180;

const QUICK_KEYS: Array<{ keys: string; label: string }> = [
  { keys: 'F2', label: 'Scan box' },
  { keys: 'F4', label: 'Charge / Pay' },
  { keys: 'F8', label: 'Hold sale' },
  { keys: 'F9', label: 'Retrieve' },
  { keys: 'Alt+C', label: 'Customer' },
  { keys: 'Alt+Shift+D', label: 'Discount & promo' },
];

function variantLabel(variant: ProductVariant): string {
  return [variant.form, variant.packSize].filter(Boolean).join(' / ') || 'Default';
}

/**
 * Dedicated keyboard-only POS surface.
 *
 * The product grid and category tabs are not mounted at all: everything the
 * cashier needs is reachable from one always-focused scan box, a keyboard-
 * navigable match list and the ticket.
 *
 * UI update #12: the ticket (the added products) is page-wide on the left,
 * directly under the scan box; the right rail keeps only the customer,
 * discounts/promo, totals and pay actions. The line items are therefore
 * rendered exactly once, in `CartLineItems`.
 */
export function KeyboardPOSWorkspace({ shiftId, lankaQr }: KeyboardPOSWorkspaceProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const rowRefs = useRef<Array<HTMLLIElement | null>>([]);

  const addItem = useCartStore((s) => s.addItem);
  const cartCount = useCartStore((s) => s.items.length);

  const { data, isLoading, isError } = usePOSProducts({
    categoryId: null,
    search: debouncedQuery,
    page: 1,
  });

  const rows = useMemo<ConsoleRow[]>(() => {
    const list: ConsoleRow[] = [];
    for (const product of data?.data ?? []) {
      for (const variant of product.variants ?? []) {
        list.push({ key: variant.id, product, variant });
      }
    }
    return list;
  }, [data?.data]);

  const searching = query.trim().length > 0;
  const safeHighlighted = rows.length === 0 ? 0 : Math.min(highlighted, rows.length - 1);

  const showFeedback = useCallback((next: ScanFeedback) => {
    setFeedback(next);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 2600);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      // A new result set always starts on the first row.
      setHighlighted(0);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    rowRefs.current[safeHighlighted]?.scrollIntoView({ block: 'nearest' });
  }, [safeHighlighted, rows.length]);

  useEffect(
    () => () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    },
    [],
  );

  const addVariant = useCallback(
    (product: ProductListItem, variant: ProductVariant): boolean => {
      if (variant.stockQuantity <= 0) {
        toast.warning(`Out of stock: ${product.name}`);
        showFeedback({ type: 'warning', text: `Out of stock - ${product.name}` });
        return false;
      }
      const description = variantLabel(variant);
      const result = addItem({
        variantId: variant.id,
        productName: product.name,
        variantDescription: description,
        sku: variant.sku,
        unitPrice: Number(variant.retailPrice),
        quantity: 1,
        stockQuantity: variant.stockQuantity,
        taxRule: product.taxRule ?? 'STANDARD_VAT',
      });
      if (result.limited) {
        toast.warning(`Only ${variant.stockQuantity} in stock for ${product.name}`);
        showFeedback({ type: 'warning', text: `Stock limit - ${product.name}` });
      } else {
        toast.success(`Added ${product.name} to cart`);
        showFeedback({
          type: 'success',
          text: `Added ${product.name}${description !== 'Default' ? ` · ${description}` : ''}`,
        });
      }
      setQuery('');
      setDebouncedQuery('');
      setHighlighted(0);
      focusPOSBarcodeInput();
      return true;
    },
    [addItem, showFeedback],
  );

  const handleScan = useCallback(
    (productName: string, variantDescription: string) => {
      showFeedback({
        type: 'success',
        text: `Added ${productName}${
          variantDescription && variantDescription !== 'Default' ? ` · ${variantDescription}` : ''
        }`,
      });
    },
    [showFeedback],
  );

  // Window-level fallback for scans typed while focus sits on a cart row.
  useBarcodeScanner({ enabled: true, onScan: handleScan });
  const { scanBarcode } = useBarcodeScanToCart(handleScan);

  /** Last-resort exact-SKU resolver for codes not present on screen. */
  const lookupVariantBySku = useCallback(
    async (code: string): Promise<{ product: ProductListItem; variant: ProductVariant } | null> => {
      if (!/^[a-zA-Z0-9._-]{4,40}$/.test(code)) return null;
      try {
        const res = await fetch(
          `/api/store/products?search=${encodeURIComponent(code)}&limit=10`,
        );
        if (!res.ok) return null;
        const json = await res.json();
        const list: ProductListItem[] = Array.isArray(json?.data) ? json.data : [];
        const lowered = code.toLowerCase();
        for (const product of list) {
          const variant = (product.variants ?? []).find(
            (candidate) => candidate.sku.toLowerCase() === lowered,
          );
          if (variant) return { product, variant };
        }
        return null;
      } catch {
        return null;
      }
    },
    [],
  );

  const handleScanSubmit = useCallback(
    async (rawCode: string): Promise<boolean> => {
      const code = rawCode.trim();
      if (!code) return false;

      const lowered = code.toLowerCase();
      const exact = rows.find(
        (row) =>
          row.variant.sku.toLowerCase() === lowered ||
          row.variant.barcode?.toLowerCase() === lowered,
      );
      if (exact) return addVariant(exact.product, exact.variant);

      // A highlighted result that still contains what was typed wins over the
      // barcode lookup: names like "Triphala" also match the barcode shape and
      // must not be reported as an unknown barcode.
      const row = rows[safeHighlighted];
      const matchesTerm =
        row != null &&
        (row.product.name.toLowerCase().includes(lowered) ||
          row.variant.sku.toLowerCase().includes(lowered) ||
          row.variant.barcode?.toLowerCase() === lowered);
      if (row && matchesTerm) return addVariant(row.product, row.variant);

      const looksLikeBarcode = /^[a-zA-Z0-9-]{8,20}$/.test(code);
      if (looksLikeBarcode) {
        const result = await scanBarcode(code);
        if (result.ok || result.productName) return true;
      }

      const skuMatch = await lookupVariantBySku(code);
      if (skuMatch) return addVariant(skuMatch.product, skuMatch.variant);

      if (looksLikeBarcode) {
        toast.error(`Unknown barcode: ${code}`);
        showFeedback({ type: 'error', text: `Unknown barcode - ${code}` });
      }
      return false;
    },
    [rows, safeHighlighted, addVariant, scanBarcode, lookupVariantBySku, showFeedback],
  );

  const onConsoleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    if (!searching || rows.length === 0) return;
    event.preventDefault();
    setHighlighted((current) => {
      const base = Math.min(current, rows.length - 1);
      if (event.key === 'ArrowDown') return (base + 1) % rows.length;
      return (base - 1 + rows.length) % rows.length;
    });
  };

  return (
    <div
      data-testid="keyboard-pos-workspace"
      className="flex min-h-0 w-full flex-1 flex-col md:flex-row"
    >
      <section
        onKeyDown={onConsoleKeyDown}
        className="flex min-h-0 min-w-0 flex-1 flex-col bg-linen"
      >
        <div className="shrink-0 border-b border-mist/60 px-4 py-3 xl:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-espresso text-pearl shadow-sm">
                <Keyboard className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-display text-lg font-bold leading-tight text-espresso">
                  Keyboard console
                </p>
                <p className="truncate font-body text-xs text-mist-ink">
                  Scan or type - the ticket fills this side; no product grid or categories.
                </p>
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#2D6A4F]/25 bg-[#2D6A4F]/10 px-3 py-1 font-body text-[11px] font-medium text-[#2D6A4F]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#2D6A4F]" />
              Scanner ready
            </span>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4 xl:px-6">
          {/*
           * Scan box + transient match list. The matches float over the ticket
           * (rather than sitting in the flex column), so an open query never
           * squeezes the page-wide cart at short laptop heights.
           */}
          <div className="relative shrink-0">
            <div className="rounded-xl border border-mist/60 bg-pearl p-3 shadow-sm">
              <POSScanInput
                value={query}
                onValueChange={setQuery}
                onScan={handleScanSubmit}
                placeholder="Scan barcode or type product name / SKU…"
              />
            </div>

            {feedback && (
              <div
                role="status"
                aria-live="polite"
                data-testid="pos-console-feedback"
                className={`mt-3 rounded-lg px-4 py-2.5 font-body text-sm font-medium text-white shadow-sm ${
                  feedback.type === 'success'
                    ? 'bg-[#2D6A4F]'
                    : feedback.type === 'warning'
                      ? 'bg-amber-600'
                      : 'bg-red-600'
                }`}
              >
                {feedback.text}
              </div>
            )}

            {searching && (
              <div
                data-testid="pos-console-matches"
                className="absolute inset-x-0 top-full z-30 mt-2 flex max-h-72 flex-col overflow-hidden rounded-xl border border-mist/60 bg-pearl shadow-xl"
              >
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-mist/50 px-4 py-2.5">
                  <p className="font-body text-sm font-medium text-espresso">
                    {isLoading
                      ? 'Searching…'
                      : `${rows.length} matching variant${rows.length === 1 ? '' : 's'}`}
                  </p>
                  <p className="hidden font-body text-[11px] text-mist-ink sm:block">
                    <kbd className="rounded border border-mist bg-white px-1 font-mono">↑</kbd>{' '}
                    <kbd className="rounded border border-mist bg-white px-1 font-mono">↓</kbd>{' '}
                    choose
                    <span className="mx-1">·</span>
                    <kbd className="rounded border border-mist bg-white px-1 font-mono">Enter</kbd>{' '}
                    add
                    <span className="mx-1">·</span>
                    <kbd className="rounded border border-mist bg-white px-1 font-mono">Esc</kbd>{' '}
                    clear
                  </p>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto">
                  {isLoading ? (
                    <ul className="divide-y divide-mist/40" aria-label="Loading products">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <li key={index} className="flex items-center gap-3 px-4 py-3">
                          <div className="h-9 w-9 animate-pulse rounded-lg bg-mist/40" />
                          <div className="flex-1 space-y-1.5">
                            <div className="h-3 w-1/2 animate-pulse rounded bg-mist/40" />
                            <div className="h-2.5 w-1/3 animate-pulse rounded bg-mist/30" />
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : isError ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-mist-ink">
                      <PackagePlus className="h-8 w-8" aria-hidden="true" />
                      <p className="font-body text-sm">Could not load matches. Try again.</p>
                    </div>
                  ) : rows.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-mist-ink">
                      <PackagePlus className="h-8 w-8" aria-hidden="true" />
                      <p className="font-body text-sm">No products match “{query.trim()}”.</p>
                      <p className="font-body text-xs">
                        Clear the box with <kbd className="font-mono">Esc</kbd> and try another
                        name, SKU or barcode.
                      </p>
                    </div>
                  ) : (
                    <ul role="listbox" aria-label="Matching products" className="divide-y divide-mist/40">
                      {rows.map((row, index) => {
                        const active = index === safeHighlighted;
                        const outOfStock = row.variant.stockQuantity <= 0;
                        return (
                          <li
                            key={row.key}
                            ref={(element) => {
                              rowRefs.current[index] = element;
                            }}
                            role="option"
                            aria-selected={active}
                            data-testid="pos-console-result"
                            data-active={active ? 'true' : undefined}
                            onMouseEnter={() => setHighlighted(index)}
                            onClick={() => addVariant(row.product, row.variant)}
                            className={`flex cursor-pointer items-center gap-3 border-l-4 px-4 py-3 transition-colors ${
                              active
                                ? 'border-terracotta bg-linen'
                                : 'border-transparent hover:bg-linen/60'
                            }`}
                          >
                            <span
                              className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                                active ? 'bg-terracotta text-pearl' : 'bg-sand/30 text-espresso'
                              }`}
                            >
                              <Sparkles className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-body text-sm font-medium text-espresso">
                                {row.product.name}
                              </p>
                              <p className="truncate font-body text-xs text-mist-ink">
                                {variantLabel(row.variant)} ·{' '}
                                <span className="font-mono">{row.variant.sku}</span>
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="font-mono text-sm font-bold text-espresso">
                                {formatRupee(Number(row.variant.retailPrice))}
                              </p>
                              <p
                                className={`font-body text-[11px] ${
                                  outOfStock ? 'text-[#9B2226]' : 'text-mist-ink'
                                }`}
                              >
                                {outOfStock ? 'Out of stock' : `${row.variant.stockQuantity} in stock`}
                              </p>
                            </div>
                            <kbd
                              className={`hidden shrink-0 rounded border px-1.5 py-0.5 font-mono text-[11px] lg:block ${
                                active
                                  ? 'border-terracotta/40 bg-white text-espresso'
                                  : 'border-mist bg-white text-mist-ink/60'
                              }`}
                            >
                              ⏎
                            </kbd>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Page-wide ticket — the only place the cart line items render. */}
          <div
            data-testid="keyboard-ticket"
            className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-mist/60 bg-pearl"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-mist/50 px-4 py-2.5">
              <p className="flex items-center gap-2 font-body text-sm font-medium text-espresso">
                Ticket
                {cartCount > 0 && (
                  <span className="rounded-full bg-terracotta px-2 py-0.5 font-body text-[11px] text-pearl">
                    {cartCount}
                  </span>
                )}
              </p>
              <p className="hidden font-body text-[11px] text-mist-ink sm:block">
                <kbd className="rounded border border-mist bg-white px-1 font-mono">↑</kbd>{' '}
                <kbd className="rounded border border-mist bg-white px-1 font-mono">↓</kbd> lines
                <span className="mx-1">·</span>
                <kbd className="rounded border border-mist bg-white px-1 font-mono">+</kbd>{' '}
                <kbd className="rounded border border-mist bg-white px-1 font-mono">−</kbd> qty
                <span className="mx-1">·</span>
                <kbd className="rounded border border-mist bg-white px-1 font-mono">Del</kbd>{' '}
                remove
              </p>
            </div>

            <CartLineItems
              className="min-h-0 flex-1 overflow-y-auto"
              emptyMessage="No items yet - scan or type above to start the sale."
            />
          </div>
        </div>

        <div className="shrink-0 border-t border-mist/60 bg-pearl/70 px-4 py-2.5 xl:px-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="inline-flex items-center gap-1.5 font-body text-[11px] font-medium uppercase tracking-wide text-mist-ink">
              <UtensilsCrossed className="h-3.5 w-3.5" aria-hidden="true" />
              Fast keys
            </span>
            {QUICK_KEYS.map((item) => (
              <span key={item.keys} className="inline-flex items-center gap-1.5 font-body text-xs text-mist-ink">
                <kbd className="rounded border border-mist bg-white px-1.5 py-0.5 font-mono text-[11px] text-espresso">
                  {item.keys}
                </kbd>
                {item.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Summary rail — the ticket itself is on the left, so this keeps only
          the customer, discounts/promo, totals and pay actions. */}
      <aside className="flex min-h-0 w-full shrink-0 flex-col border-mist/60 bg-pearl md:w-[31%] md:min-w-[320px] md:max-w-[430px] md:border-l">
        <ErrorBoundary>
          <CartPanel shiftId={shiftId} lankaQr={lankaQr} showLineItems={false} />
        </ErrorBoundary>
      </aside>
    </div>
  );
}
