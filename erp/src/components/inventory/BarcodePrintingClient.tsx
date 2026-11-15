'use client';

import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Barcode as BarcodeIcon,
  Minus,
  Plus,
  Printer,
  Search,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useProducts } from '@/hooks/useProducts';
import {
  BarcodeSheetPage,
  type SheetLabelData,
} from '@/components/inventory/BarcodeSheet';
import {
  BARCODE_LABELS_PER_SHEET,
  countBarcodeLabels,
  paginateBarcodeSheet,
} from '@/lib/barcode-sheet.core';
import { PRINT_OVERLAY_CLASS, renderPrintOverlay } from '@/lib/print-overlay';

// ── Types ────────────────────────────────────────────────────────────────────

interface VariantOption {
  variantId: string;
  productId: string;
  productName: string;
  brandName: string | null;
  sku: string;
  barcode: string;
  form: string | null;
  packSize: string | null;
  retailPrice: number;
}

interface QueueItem extends VariantOption {
  copies: number;
}

const MIN_COPIES = 1;
const MAX_COPIES = 99;

function clampCopies(value: number): number {
  if (!Number.isFinite(value)) return MIN_COPIES;
  return Math.max(MIN_COPIES, Math.min(MAX_COPIES, Math.floor(value)));
}

// ── Component ────────────────────────────────────────────────────────────────

export function BarcodePrintingClient() {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [fillLastSheet, setFillLastSheet] = useState(false);

  const { data, isLoading } = useProducts({
    search: deferredSearch.trim() || undefined,
    limit: 25,
    status: 'active',
  });

  const options = useMemo<VariantOption[]>(() => {
    const rows: VariantOption[] = [];
    for (const product of data?.data ?? []) {
      for (const variant of product.variants ?? []) {
        rows.push({
          variantId: variant.id,
          productId: product.id,
          productName: product.name,
          brandName: product.brand?.name ?? null,
          sku: variant.sku,
          // Legacy rows without a barcode fall back to the SKU, mirroring the
          // inventory label dialog, so printing is never blocked.
          barcode: variant.barcode ?? variant.sku,
          form: variant.form,
          packSize: variant.packSize,
          retailPrice: Number(variant.retailPrice),
        });
      }
    }
    return rows;
  }, [data]);

  const addVariant = useCallback((option: VariantOption) => {
    setQueue((current) => {
      const existing = current.find((item) => item.variantId === option.variantId);
      if (existing) {
        return current.map((item) =>
          item.variantId === option.variantId
            ? { ...item, copies: clampCopies(item.copies + 1) }
            : item,
        );
      }
      return [...current, { ...option, copies: 1 }];
    });
  }, []);

  const removeVariant = useCallback((variantId: string) => {
    setQueue((current) => current.filter((item) => item.variantId !== variantId));
  }, []);

  const setCopies = useCallback((variantId: string, copies: number) => {
    setQueue((current) =>
      current.map((item) =>
        item.variantId === variantId ? { ...item, copies: clampCopies(copies) } : item,
      ),
    );
  }, []);

  const pages = useMemo(
    () => paginateBarcodeSheet(queue, { fillLastSheet }),
    [queue, fillLastSheet],
  );

  const totalLabels = useMemo(
    () => countBarcodeLabels(queue, { fillLastSheet }),
    [queue, fillLastSheet],
  );

  const sheetPages = useMemo<SheetLabelData[][]>(
    () =>
      pages.map((page, pageIndex) =>
        page.map((item, labelIndex) => ({
          key: `${pageIndex}-${labelIndex}-${item.variantId}`,
          productName: item.productName,
          sku: item.sku,
          barcode: item.barcode,
          form: item.form,
          packSize: item.packSize,
          retailPrice: item.retailPrice,
        })),
      ),
    [pages],
  );

  const handlePrint = useCallback(() => {
    if (sheetPages.length === 0) return;

    renderPrintOverlay(
      <div>
        {sheetPages.map((labels, index) => (
          // Print pages carry no preview scale and are emitted 1:1.
          <BarcodeSheetPage key={`print-${index}`} labels={labels} />
        ))}
      </div>,
      {
        printStyles: `
          @page { size: A4 portrait; margin: 0; }
          .${PRINT_OVERLAY_CLASS} { padding: 0 !important; }
          .barcode-sheet-page { break-after: page; page-break-after: always; }
          .barcode-sheet-page:last-child { break-after: auto; page-break-after: auto; }
        `,
      },
    );
  }, [sheetPages]);

  const addedIds = useMemo(() => new Set(queue.map((item) => item.variantId)), [queue]);

  return (
    <div data-testid="barcode-printing-page" className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="-ml-2 h-7 px-2 text-mist-ink hover:text-espresso"
            >
              <Link href="/inventory">
                <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                Inventory
              </Link>
            </Button>
          </div>
          <h1 className="font-display text-3xl text-espresso">Barcode Printing</h1>
          <p className="mt-1 max-w-2xl font-body text-sm text-mist-ink">
            Add products to the queue, then print their barcodes on A4 sheets
            ({BARCODE_LABELS_PER_SHEET} labels per page). Extra labels flow onto another
            page automatically.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div
              data-testid="barcode-total-labels"
              className="font-display text-2xl leading-none text-espresso"
            >
              {totalLabels}
            </div>
            <div className="font-body text-xs text-mist-ink">
              label{totalLabels === 1 ? '' : 's'} · {pages.length} page
              {pages.length === 1 ? '' : 's'}
            </div>
          </div>
          <Button
            className="bg-espresso text-pearl hover:bg-espresso/90"
            onClick={handlePrint}
            disabled={totalLabels === 0}
          >
            <Printer className="mr-2 h-4 w-4" />
            Print A4
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(340px,420px)_minmax(0,1fr)]">
        {/* ── Left: picker + queue ───────────────────────────────────────── */}
        <div className="space-y-4">
          <section className="rounded-lg border border-sand/40 bg-pearl">
            <div className="border-b border-sand/40 p-3">
              <label
                htmlFor="barcode-product-search"
                className="mb-1.5 block font-body text-xs font-medium text-espresso"
              >
                Add products
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-mist-ink" />
                <Input
                  id="barcode-product-search"
                  data-testid="barcode-product-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by product, SKU or barcode"
                  className="pl-8"
                />
              </div>
            </div>

            <div className="max-h-[320px] overflow-y-auto">
              {isLoading ? (
                <div className="space-y-2 p-3">
                  {[0, 1, 2, 3].map((row) => (
                    <Skeleton key={row} className="h-9 w-full" />
                  ))}
                </div>
              ) : options.length === 0 ? (
                <p className="p-4 font-body text-sm text-mist-ink">
                  No products match “{search.trim()}”.
                </p>
              ) : (
                <ul className="divide-y divide-sand/30">
                  {options.map((option) => {
                    const added = addedIds.has(option.variantId);
                    const variantText = [option.form, option.packSize]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <li
                        key={option.variantId}
                        data-testid="barcode-result-row"
                        className="flex items-center gap-3 px-3 py-2"
                      >
                        <BarcodeIcon className="h-4 w-4 shrink-0 text-mist-ink" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-body text-sm text-espresso">
                            {option.productName}
                          </div>
                          <div className="truncate font-body text-xs text-mist-ink">
                            {variantText ? `${variantText} · ` : ''}
                            <span className="font-mono">{option.sku}</span>
                            {' · '}
                            <span className="font-mono">{option.barcode}</span>
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant={added ? 'outline' : 'default'}
                          className={
                            added
                              ? 'border-sand text-espresso'
                              : 'bg-espresso text-pearl hover:bg-espresso/90'
                          }
                          aria-label={`Add ${option.sku}`}
                          onClick={() => addVariant(option)}
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          Add
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-sand/40 bg-pearl">
            <div className="flex items-center justify-between border-b border-sand/40 px-3 py-2.5">
              <span className="font-body text-sm font-medium text-espresso">
                Selected products
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-mist-ink hover:text-espresso"
                onClick={() => setQueue([])}
                disabled={queue.length === 0}
              >
                Clear all
              </Button>
            </div>

            {queue.length === 0 ? (
              <p className="p-4 font-body text-sm text-mist-ink">
                Nothing selected yet. Add a product variant above to place its barcode on
                the A4 sheet.
              </p>
            ) : (
              <ul className="max-h-[360px] divide-y divide-sand/30 overflow-y-auto">
                {queue.map((item) => {
                  const variantText = [item.form, item.packSize]
                    .filter(Boolean)
                    .join(' · ');
                  return (
                    <li
                      key={item.variantId}
                      data-testid="barcode-selected-row"
                      className="flex items-center gap-3 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-body text-sm text-espresso">
                          {item.productName}
                        </div>
                        <div className="truncate font-body text-xs text-mist-ink">
                          {variantText ? `${variantText} · ` : ''}
                          <span className="font-mono">{item.sku}</span>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded border border-sand text-espresso hover:bg-sand/20"
                          aria-label={`Decrease copies for ${item.sku}`}
                          onClick={() => setCopies(item.variantId, item.copies - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <input
                          type="number"
                          min={MIN_COPIES}
                          max={MAX_COPIES}
                          value={item.copies}
                          aria-label={`Copies for ${item.sku}`}
                          onChange={(event) =>
                            setCopies(item.variantId, Number(event.target.value))
                          }
                          className="h-7 w-12 rounded border border-sand bg-pearl text-center font-mono text-xs text-espresso focus:ring-1 focus:ring-espresso focus:outline-none"
                        />
                        <button
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded border border-sand text-espresso hover:bg-sand/20"
                          aria-label={`Increase copies for ${item.sku}`}
                          onClick={() => setCopies(item.variantId, item.copies + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      <button
                        type="button"
                        className="shrink-0 rounded p-1.5 text-mist-ink hover:bg-red-50 hover:text-red-600"
                        aria-label={`Remove ${item.sku}`}
                        onClick={() => removeVariant(item.variantId)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="flex items-center justify-between gap-3 border-t border-sand/40 px-3 py-2.5">
              <label
                htmlFor="fill-last-sheet"
                className="flex items-center gap-2 font-body text-xs text-espresso"
              >
                <Switch
                  id="fill-last-sheet"
                  checked={fillLastSheet}
                  onCheckedChange={setFillLastSheet}
                  aria-label="Fill last sheet"
                />
                Fill the last sheet
              </label>
              <span className="font-body text-xs text-mist-ink">
                {totalLabels} / {pages.length * BARCODE_LABELS_PER_SHEET} slots
              </span>
            </div>
          </section>
        </div>

        {/* ── Right: A4 preview ──────────────────────────────────────────── */}
        <section className="rounded-lg border border-sand/40 bg-linen/40">
          <div className="flex items-center justify-between border-b border-sand/40 px-4 py-2.5">
            <span className="font-body text-sm font-medium text-espresso">
              A4 preview · portrait
            </span>
            <span
              data-testid="barcode-page-count"
              className="font-body text-xs text-mist-ink"
            >
              {pages.length === 0
                ? 'No pages yet'
                : `Page 1 of ${pages.length}`}
            </span>
          </div>

          <div className="max-h-[calc(100vh-14rem)] overflow-auto p-4">
            {sheetPages.length === 0 ? (
              <div className="flex min-h-[420px] items-center justify-center rounded border border-dashed border-sand/70 bg-pearl/60">
                <div className="max-w-xs text-center">
                  <BarcodeIcon className="mx-auto mb-2 h-8 w-8 text-sand" />
                  <p className="font-body text-sm text-mist-ink">
                    The A4 sheet fills as you add products. Each page holds{' '}
                    {BARCODE_LABELS_PER_SHEET} barcodes.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-6">
                {sheetPages.map((labels, index) => (
                  <div key={`preview-${index}`} className="w-full max-w-[560px]">
                    <div className="mb-1.5 flex items-center justify-between font-body text-xs text-mist-ink">
                      <span>Page {index + 1}</span>
                      <span>
                        {labels.length} label{labels.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <BarcodeSheetPage labels={labels} scale={0.68} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
