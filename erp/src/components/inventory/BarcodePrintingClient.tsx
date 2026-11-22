'use client';

import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Barcode as BarcodeIcon,
  ChevronLeft,
  ChevronRight,
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
  ProductThumbnail,
  resolveProductThumbnail,
} from '@/components/sales/ProductThumbnail';
import {
  BarcodeSheetPage,
  type SheetLabelData,
} from '@/components/inventory/BarcodeSheet';
import { BarcodeLabel } from '@/components/inventory/BarcodeLabel';
import {
  BARCODE_LABEL_TEMPLATES,
  barcodeLabelTemplateSummary,
  getBarcodeLabelTemplate,
  type BarcodeLabelTemplateId,
} from '@/lib/barcode-label-templates.core';
import {
  formatBarcodeProductPage,
  formatBarcodeVariantRange,
  hasPrintableBarcode,
} from '@/lib/barcode-printing.core';
import { selectBarcodeSearchRows } from '@/lib/barcode-printing-search.core';
import { labelPriceDisplay } from '@/lib/pricing/label-price.core';
import { useTaxRates } from '@/hooks/useTaxRates';
import {
  BARCODE_LABELS_PER_SHEET,
  countBarcodeLabels,
  paginateBarcodeSheet,
  planBarcodeCopies,
} from '@/lib/barcode-sheet.core';
import { PRINT_OVERLAY_CLASS, renderPrintOverlay } from '@/lib/print-overlay';

// ── Types ────────────────────────────────────────────────────────────────────

interface VariantOption {
  variantId: string;
  productId: string;
  productName: string;
  brandName: string | null;
  sku: string;
  /** Null when no barcode is saved; never silently replaced with the SKU. */
  barcode: string | null;
  form: string | null;
  packSize: string | null;
  retailPrice: number;
  /** Product tax rule; labels print the tax-inclusive shelf price (ARGUS #160). */
  taxRule: string | null;
  stockQuantity: number;
  lowStockThreshold: number;
  imageUrl: string | null;
}

interface BarcodeReadyVariant extends VariantOption {
  barcode: string;
}

interface QueueItem extends BarcodeReadyVariant {
  copies: number;
}

const MIN_COPIES = 1;
const MAX_COPIES = 99;
/** Products fetched per page; ordering (newest first) is server-side. */
const PRODUCTS_PER_PAGE = 10;

function clampCopies(value: number): number {
  if (!Number.isFinite(value)) return MIN_COPIES;
  return Math.max(MIN_COPIES, Math.min(MAX_COPIES, Math.floor(value)));
}

// ── Component ────────────────────────────────────────────────────────────────

export function BarcodePrintingClient() {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [page, setPage] = useState(1);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [fillLastSheet, setFillLastSheet] = useState(false);
  // ARGUS #162: clamping and queue changes must be stated, not silent.
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  // Both entry points offer exactly the same two templates (ARGUS #157).
  const [templateId, setTemplateId] =
    useState<BarcodeLabelTemplateId>('a4-24up');
  const template = getBarcodeLabelTemplate(templateId);
  const isA4 = !template.continuousRoll;
  const { data: taxRates } = useTaxRates();
  const vatRate = taxRates?.vatRate ?? 0;
  const ssclRate = taxRates?.ssclRate ?? 0;

  const { data, isLoading, isFetching } = useProducts({
    search: deferredSearch.trim() || undefined,
    limit: PRODUCTS_PER_PAGE,
    page,
    status: 'active',
  });

  const totalProducts = data?.meta?.total ?? 0;
  const variantTotal = data?.meta?.variantTotal ?? 0;
  const totalPages = Math.max(1, data?.meta?.totalPages ?? 1);
  const firstOnPage = totalProducts === 0 ? 0 : (page - 1) * PRODUCTS_PER_PAGE + 1;
  const lastOnPage = Math.min(page * PRODUCTS_PER_PAGE, totalProducts);

  const searchTerm = deferredSearch.trim();

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
          // ARGUS #163: never substitute the SKU. A missing barcode blocks the
          // Add action and is named in the picker row.
          barcode: hasPrintableBarcode(variant.barcode) ? variant.barcode : null,
          form: variant.form,
          packSize: variant.packSize,
          retailPrice: Number(variant.retailPrice),
          taxRule: product.taxRule ?? null,
          stockQuantity: variant.stockQuantity,
          lowStockThreshold: variant.lowStockThreshold,
          imageUrl: resolveProductThumbnail(
            product.mainImageThumbnailUrl,
            product.mainImageUrl,
            variant.thumbnailImageUrls,
            variant.imageUrls,
          ),
        });
      }
    }
    // The API matches products, so filter the rows here: an exact barcode/SKU
    // wins alone instead of listing every sibling pack (ARGUS #159).
    return selectBarcodeSearchRows(rows, searchTerm).map((entry) => entry.row);
  }, [data, searchTerm]);

  const addVariant = useCallback((option: BarcodeReadyVariant) => {
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
    setCopyNotice(null);
  }, []);

  /**
   * ARGUS #162: copy counts are clamped to 1-99. Say so instead of silently
   * turning 0 into 1 or 100 into 99.
   */
  const updateCopies = useCallback(
    (variantId: string, sku: string, requested: number) => {
      const next = clampCopies(requested);
      if (!Number.isFinite(requested) || next !== requested) {
        setCopyNotice(
          `Copies for ${sku} must be between ${MIN_COPIES} and ${MAX_COPIES} - set to ${next}.`,
        );
      } else {
        setCopyNotice(null);
      }
      setQueue((current) =>
        current.map((item) =>
          item.variantId === variantId ? { ...item, copies: next } : item,
        ),
      );
    },
    [],
  );

  const handleAdd = useCallback(
    (option: VariantOption) => {
      if (!hasPrintableBarcode(option.barcode)) {
        setCopyNotice(
          `${option.productName} (${option.sku}) has no saved barcode - set one in Inventory before printing.`,
        );
        return;
      }
      const printable: BarcodeReadyVariant = { ...option, barcode: option.barcode };
      const existing = queue.find((item) => item.variantId === option.variantId);
      if (existing) {
        const next = clampCopies(existing.copies + 1);
        setCopyNotice(
          next === existing.copies
            ? `${option.sku} is already at the maximum of ${MAX_COPIES} copies.`
            : `Added another copy of ${option.sku} - ${next} copies queued.`,
        );
      } else {
        setCopyNotice(`Added ${option.sku} - 1 copy queued.`);
      }
      addVariant(printable);
    },
    [queue, addVariant],
  );

  const pages = useMemo(
    () => (isA4 ? paginateBarcodeSheet(queue, { fillLastSheet }) : []),
    [isA4, queue, fillLastSheet],
  );

  const totalLabels = useMemo(
    () =>
      isA4
        ? countBarcodeLabels(queue, { fillLastSheet })
        : countBarcodeLabels(queue),
    [isA4, queue, fillLastSheet],
  );

  // ARGUS #162: `fillLastSheet` pads the page with extra copies, so a row that
  // requests 25 copies can print more. Plan per row so the queue tells the
  // truth next to the total.
  const copyPlan = useMemo(
    () => planBarcodeCopies(queue, { fillLastSheet: isA4 && fillLastSheet }),
    [queue, isA4, fillLastSheet],
  );

  const thermalLabels = useMemo(
    () =>
      queue.flatMap((item) =>
        Array.from({ length: clampCopies(item.copies) }, (_, index) => {
          const price = labelPriceDisplay({
            retailPrice: item.retailPrice,
            taxRule: item.taxRule,
            vatRate,
            ssclRate,
          });
          return {
            ...item,
            key: `${item.variantId}-${index}`,
            retailPrice: price.amount,
            priceQualifier: price.qualifier,
          };
        }),
      ),
    [queue, vatRate, ssclRate],
  );

  const sheetPages = useMemo<SheetLabelData[][]>(
    () =>
      pages.map((page, pageIndex) =>
        page.map((item, labelIndex) => {
          const price = labelPriceDisplay({
            retailPrice: item.retailPrice,
            taxRule: item.taxRule,
            vatRate,
            ssclRate,
          });
          return {
            key: `${pageIndex}-${labelIndex}-${item.variantId}`,
            productName: item.productName,
            sku: item.sku,
            barcode: item.barcode,
            form: item.form,
            packSize: item.packSize,
            retailPrice: price.amount,
            priceQualifier: price.qualifier,
          };
        }),
      ),
    [pages, vatRate, ssclRate],
  );

  const handlePrint = useCallback(() => {
    if (template.continuousRoll) {
      if (thermalLabels.length === 0) return;

      renderPrintOverlay(
        <div>
          {thermalLabels.map((label) => (
            <div key={label.key} className="barcode-thermal-label">
              <BarcodeLabel
                brandName={label.brandName}
                productName={label.productName}
                sku={label.sku}
                barcode={label.barcode}
                form={label.form}
                packSize={label.packSize}
                retailPrice={label.retailPrice}
                priceQualifier={label.priceQualifier}
                stockQuantity={label.stockQuantity}
                lowStockThreshold={label.lowStockThreshold}
              />
            </div>
          ))}
        </div>,
        {
          printStyles: `
            @page { size: ${template.widthMm}mm ${template.heightMm}mm; margin: 0; }
            .${PRINT_OVERLAY_CLASS} { padding: 0 !important; }
            .barcode-thermal-label { break-after: page; page-break-after: always; }
            .barcode-thermal-label:last-child { break-after: auto; page-break-after: auto; }
            .barcode-thermal-label .barcode-label { border: 0 !important; }
          `,
        },
      );
      return;
    }

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
  }, [template, thermalLabels, sheetPages]);

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
            Add product variants to the queue, then choose a label template and
            print. Both the A4 24-up sheet and the thermal 4 x 6 cm roll use one
            shared specification, so a variant prints the same fields at every
            entry point.
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
              label{totalLabels === 1 ? '' : 's'} ·{' '}
              {isA4
                ? `${pages.length} page${pages.length === 1 ? '' : 's'}`
                : 'thermal roll'}
            </div>
          </div>
          <Button
            className="bg-espresso text-pearl hover:bg-espresso/90"
            onClick={handlePrint}
            disabled={totalLabels === 0}
          >
            <Printer className="mr-2 h-4 w-4" />
            Print {isA4 ? 'A4' : 'thermal'}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-sand/40 bg-pearl px-3 py-2">
        <span className="font-body text-xs font-medium text-espresso">
          Label template
        </span>
        {BARCODE_LABEL_TEMPLATES.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={option.id === templateId}
            data-testid={`barcode-template-${option.id}`}
            onClick={() => setTemplateId(option.id)}
            className={`rounded-md px-3 py-1.5 font-body text-xs transition-colors ${
              option.id === templateId
                ? 'bg-espresso text-pearl'
                : 'border border-sand bg-pearl text-espresso hover:bg-sand/20'
            }`}
          >
            {option.name}
          </button>
        ))}
        <span className="w-full font-body text-xs text-mist-ink">
          {barcodeLabelTemplateSummary(template)}
        </span>
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
                Add variants
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-mist-ink" />
                <Input
                  id="barcode-product-search"
                  data-testid="barcode-product-search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
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
                  No variants match "{search.trim()}".
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
                        <ProductThumbnail
                          src={option.imageUrl}
                          alt={option.productName}
                          size={36}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-body text-sm text-espresso">
                            {option.productName}
                          </div>
                          <div className="truncate font-body text-xs text-mist-ink">
                            {variantText ? `${variantText} · ` : ''}
                            <span className="font-mono">{option.sku}</span>
                            {' · '}
                            {hasPrintableBarcode(option.barcode) ? (
                              <span className="font-mono">{option.barcode}</span>
                            ) : (
                              <span className="text-[#9B2226]">
                                no barcode saved - set one in Inventory
                              </span>
                            )}
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
                          aria-label={
                            hasPrintableBarcode(option.barcode)
                              ? added
                                ? `Add another copy of ${option.sku}`
                                : `Add ${option.sku}`
                              : `${option.sku} has no saved barcode and cannot be printed`
                          }
                          disabled={!hasPrintableBarcode(option.barcode)}
                          title={
                            hasPrintableBarcode(option.barcode)
                              ? undefined
                              : 'Add a barcode to this variant in Inventory first'
                          }
                          onClick={() => handleAdd(option)}
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          {hasPrintableBarcode(option.barcode)
                            ? added
                              ? 'Add another'
                              : 'Add'
                            : 'No barcode'}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-sand/40 px-3 py-2">
              <span
                data-testid="barcode-products-range"
                className="font-body text-xs text-mist-ink"
              >
                {formatBarcodeVariantRange({
                  firstProduct: firstOnPage,
                  lastProduct: lastOnPage,
                  totalProducts,
                  variantsOnPage: options.length,
                  totalVariants: variantTotal,
                  narrowed: searchTerm.length > 0,
                })}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 border-sand p-0 text-espresso"
                  aria-label="Previous products page"
                  disabled={page <= 1 || isFetching}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span
                  data-testid="barcode-products-page"
                  aria-live="polite"
                  className="min-w-[72px] text-center font-body text-xs text-mist-ink"
                >
                  {formatBarcodeProductPage(page, totalPages)}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 border-sand p-0 text-espresso"
                  aria-label="Next products page"
                  disabled={page >= totalPages || isFetching}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-sand/40 bg-pearl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sand/40 px-3 py-2.5">
              <div>
                <span className="font-body text-sm font-medium text-espresso">
                  Selected variants
                </span>
                <span className="ml-2 font-body text-xs text-mist-ink">
                  {MIN_COPIES}-{MAX_COPIES} copies each
                </span>
              </div>
              {showClearConfirm && queue.length > 0 ? (
                <div className="flex items-center gap-2">
                  <span className="font-body text-xs text-espresso">
                    Clear {queue.length} variant{queue.length === 1 ? '' : 's'}?
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 border-sand px-2 text-espresso"
                    onClick={() => setShowClearConfirm(false)}
                  >
                    Keep
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 bg-red-600 px-2 text-white hover:bg-red-700"
                    onClick={() => {
                      setQueue([]);
                      setShowClearConfirm(false);
                      setCopyNotice('Cleared the print queue.');
                    }}
                  >
                    Clear
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-mist-ink hover:text-espresso"
                  onClick={() => setShowClearConfirm(true)}
                  disabled={queue.length === 0}
                >
                  Clear all
                </Button>
              )}
            </div>

            {queue.length === 0 ? (
              <p className="p-4 font-body text-sm text-mist-ink">
                Nothing selected yet. Add a product variant above to place its barcode on
                the A4 sheet.
              </p>
            ) : (
              <ul className="max-h-[360px] divide-y divide-sand/30 overflow-y-auto">
                {queue.map((item, index) => {
                  const variantText = [item.form, item.packSize]
                    .filter(Boolean)
                    .join(' · ');
                  const printedCopies = copyPlan.printed[index] ?? item.copies;
                  return (
                    <li
                      key={item.variantId}
                      data-testid="barcode-selected-row"
                      className="flex items-center gap-3 px-3 py-2"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <ProductThumbnail src={item.imageUrl} alt="" size={32} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-body text-sm text-espresso">
                            {item.productName}
                          </div>
                          <div className="truncate font-body text-xs text-mist-ink">
                            {variantText ? `${variantText} · ` : ''}
                            <span className="font-mono">{item.sku}</span>
                          </div>
                          <div
                            data-testid="barcode-printed-labels"
                            className="font-body text-xs text-mist-ink"
                          >
                            {printedCopies === item.copies
                              ? `prints ${printedCopies} label${printedCopies === 1 ? '' : 's'}`
                              : `prints ${printedCopies} labels (${item.copies} requested + ${
                                  printedCopies - item.copies
                                } sheet filler)`}
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded border border-sand text-espresso hover:bg-sand/20"
                          aria-label={`Decrease copies for ${item.sku}`}
                          onClick={() => updateCopies(item.variantId, item.sku, item.copies - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <input
                          type="number"
                          min={MIN_COPIES}
                          max={MAX_COPIES}
                          step={1}
                          value={item.copies}
                          aria-label={`Copies for ${item.sku}`}
                          onChange={(event) => {
                            const raw = event.target.value;
                            if (raw.trim() === '') {
                              setCopyNotice(
                                `Copy count for ${item.sku} cannot be blank - using ${MIN_COPIES}.`,
                              );
                              updateCopies(item.variantId, item.sku, MIN_COPIES);
                              return;
                            }
                            updateCopies(item.variantId, item.sku, Number(raw));
                          }}
                          className="h-7 w-12 rounded border border-sand bg-pearl text-center font-mono text-xs text-espresso focus:ring-1 focus:ring-espresso focus:outline-none"
                        />
                        <button
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded border border-sand text-espresso hover:bg-sand/20"
                          aria-label={`Increase copies for ${item.sku}`}
                          onClick={() => updateCopies(item.variantId, item.sku, item.copies + 1)}
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

            <div
              role="status"
              aria-live="polite"
              data-testid="barcode-copy-notice"
              className="min-h-[1.25rem] px-3 pt-2 font-body text-xs text-mist-ink"
            >
              {copyNotice ?? ''}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-sand/40 px-3 py-2.5">
              {isA4 ? (
                <label
                  htmlFor="fill-last-sheet"
                  className="flex items-center gap-2 font-body text-xs text-espresso"
                >
                  <Switch
                    id="fill-last-sheet"
                    checked={fillLastSheet}
                    onCheckedChange={(checked) => {
                      setFillLastSheet(checked);
                      setCopyNotice(null);
                    }}
                    aria-label="Fill last sheet"
                  />
                  Fill the last sheet
                </label>
              ) : (
                <span className="font-body text-xs text-mist-ink">
                  Continuous roll - no sheet filling
                </span>
              )}
              <span className="font-body text-xs text-mist-ink">
                {isA4
                  ? `${totalLabels} / ${pages.length * BARCODE_LABELS_PER_SHEET} slots${
                      copyPlan.filler > 0 ? ` · ${copyPlan.filler} filler` : ''
                    }`
                  : `${totalLabels} label${totalLabels === 1 ? '' : 's'}`}
              </span>
            </div>
          </section>
        </div>

        {/* ── Right: template preview ─────────────────────────────────────── */}
        <section className="rounded-lg border border-sand/40 bg-linen/40">
          <div className="flex items-center justify-between border-b border-sand/40 px-4 py-2.5">
            <span className="font-body text-sm font-medium text-espresso">
              {template.name} preview
            </span>
            <span
              data-testid="barcode-page-count"
              className="font-body text-xs text-mist-ink"
            >
              {isA4
                ? pages.length === 0
                  ? 'No pages yet'
                  : `Page 1 of ${pages.length}`
                : `${totalLabels} label${totalLabels === 1 ? '' : 's'} on a roll`}
            </span>
          </div>

          <div className="max-h-[calc(100vh-14rem)] overflow-auto p-4">
            {isA4 ? (
              sheetPages.length === 0 ? (
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
              )
            ) : thermalLabels.length === 0 ? (
              <div className="flex min-h-[420px] items-center justify-center rounded border border-dashed border-sand/70 bg-pearl/60">
                <div className="max-w-xs text-center">
                  <BarcodeIcon className="mx-auto mb-2 h-8 w-8 text-sand" />
                  <p className="font-body text-sm text-mist-ink">
                    The thermal roll fills as you add products. Each feed prints
                    one 40 x 60 mm label.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-start justify-center gap-6">
                {thermalLabels.slice(0, 2).map((label) => (
                  <div key={label.key} className="origin-top scale-75">
                    <BarcodeLabel
                      brandName={label.brandName}
                      productName={label.productName}
                      sku={label.sku}
                      barcode={label.barcode}
                      form={label.form}
                      packSize={label.packSize}
                      retailPrice={label.retailPrice}
                      priceQualifier={label.priceQualifier}
                      stockQuantity={label.stockQuantity}
                      lowStockThreshold={label.lowStockThreshold}
                    />
                  </div>
                ))}
                {thermalLabels.length > 2 ? (
                  <p className="w-full text-center font-body text-xs text-mist-ink">
                    +{thermalLabels.length - 2} more label
                    {thermalLabels.length - 2 === 1 ? '' : 's'} in the queue
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
