'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BarcodeLabel } from '@/components/inventory/BarcodeLabel';
import {
  BarcodeSheetPage,
  type SheetLabelData,
} from '@/components/inventory/BarcodeSheet';
import {
  BARCODE_LABEL_TEMPLATES,
  barcodeLabelTemplateSummary,
  getBarcodeLabelTemplate,
  type BarcodeLabelTemplateId,
} from '@/lib/barcode-label-templates.core';
import {
  BARCODE_LABELS_PER_SHEET,
  paginateBarcodeSheet,
} from '@/lib/barcode-sheet.core';
import { PRINT_OVERLAY_CLASS, renderPrintOverlay } from '@/lib/print-overlay';
import { labelPriceDisplay } from '@/lib/pricing/label-price.core';
import { useTaxRates } from '@/hooks/useTaxRates';

// ── Types ────────────────────────────────────────────────────────────────────

export interface LabelVariant {
  id: string;
  sku: string;
  barcode: string | null;
  form: string | null;
  packSize: string | null;
  retailPrice: number | string;
  stockQuantity: number;
  lowStockThreshold: number;
  brandName?: string | null | undefined;
  /** Product tax rule; labels print the tax-inclusive shelf price (ARGUS #160). */
  taxRule?: 'STANDARD_VAT' | 'SSCL' | 'EXEMPT' | string | null | undefined;
  productName: string;
}

interface BarcodeLabelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  variants: LabelVariant[];
}

// ── Component ────────────────────────────────────────────────────────────────

export function BarcodeLabelDialog({
  isOpen,
  onClose,
  variants,
}: BarcodeLabelDialogProps) {
  // Same two templates as the standalone Barcode Printing page (ARGUS #157).
  // The dialog defaults to the thermal roll because that is the common case
  // when printing straight from a product list.
  const [templateId, setTemplateId] =
    useState<BarcodeLabelTemplateId>('thermal-4x6');
  const template = getBarcodeLabelTemplate(templateId);
  const isA4 = !template.continuousRoll;
  const { data: taxRates } = useTaxRates();
  const vatRate = taxRates?.vatRate ?? 0;
  const ssclRate = taxRates?.ssclRate ?? 0;
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(variants.map((v) => [v.id, 1])),
  );
  const [previewVariantId, setPreviewVariantId] = useState<string | null>(
    variants[0]?.id ?? null,
  );
  const [a4PageIndex, setA4PageIndex] = useState(0);

  // Callers mount this dialog per selection, so the initializer above is
  // enough; a missing id falls back to a quantity of 1.
  const totalLabels = variants.reduce(
    (sum, variant) => sum + (quantities[variant.id] ?? 1),
    0,
  );

  const setQty = useCallback((id: string, value: number) => {
    const clamped = Math.max(1, Math.min(99, value));
    setQuantities((prev) => ({ ...prev, [id]: clamped }));
  }, []);

  // The A4 mode reuses the dedicated barcode-printing sheet: 3 × 8 labels of
  // 63.5 × 33.9 mm per page (24-up), paginated by the shared pure helper. The
  // old dialog claimed 32 labels per sheet but its 4 × 6 cm labels only fit
  // 4 rows (16), so the browser silently split pages (ARGUS #156).
  const a4SheetPages = useMemo<SheetLabelData[][]>(() => {
    const pages = paginateBarcodeSheet(
      variants.map((variant) => ({ variant, copies: quantities[variant.id] ?? 1 })),
    );
    return pages.map((page) =>
      page.map((entry, index) => {
        const price = labelPriceDisplay({
          retailPrice: entry.variant.retailPrice,
          taxRule: entry.variant.taxRule,
          vatRate,
          ssclRate,
        });
        return {
          key: `${entry.variant.id}-${index}`,
          productName: entry.variant.productName,
          sku: entry.variant.sku,
          barcode: entry.variant.barcode ?? entry.variant.sku,
          form: entry.variant.form,
          packSize: entry.variant.packSize,
          retailPrice: price.amount,
          priceQualifier: price.qualifier,
        };
      }),
    );
  }, [variants, quantities, vatRate, ssclRate]);

  // ── Print ────────────────────────────────────────────────────────────────

  // Expand the queue by copy count for the thermal roll.
  const printLabels = useMemo<LabelVariant[]>(() => {
    const labels: LabelVariant[] = [];
    for (const variant of variants) {
      const qty = quantities[variant.id] ?? 1;
      for (let i = 0; i < qty; i++) labels.push(variant);
    }
    return labels;
  }, [variants, quantities]);

  const handlePrint = useCallback(() => {
    if (isA4) {
      if (a4SheetPages.length === 0) return;

      // One fixed-size A4 sheet per page, explicit page breaks - never rely on
      // browser auto-pagination. Same geometry/CSS as the dedicated page.
      renderPrintOverlay(
        <div>
          {a4SheetPages.map((labels, index) => (
            <BarcodeSheetPage key={`a4-${index}`} labels={labels} />
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
      onClose();
      return;
    }

    // Thermal mode: one 40 x 60 mm label per page on a continuous roll, using
    // the same overlay pipeline as the A4 sheet instead of a private portal.
    if (printLabels.length === 0) return;

    renderPrintOverlay(
      <div>
        {printLabels.map((variant, index) => {
          const price = labelPriceDisplay({
            retailPrice: variant.retailPrice,
            taxRule: variant.taxRule,
            vatRate,
            ssclRate,
          });
          return (
            <div key={`${variant.id}-${index}`} className="barcode-thermal-label">
              <BarcodeLabel
                brandName={variant.brandName}
                productName={variant.productName}
                sku={variant.sku}
                barcode={variant.barcode}
                form={variant.form}
                packSize={variant.packSize}
                retailPrice={price.amount}
                priceQualifier={price.qualifier}
                stockQuantity={variant.stockQuantity}
                lowStockThreshold={variant.lowStockThreshold}
              />
            </div>
          );
        })}
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
    onClose();
  }, [isA4, template, a4SheetPages, printLabels, onClose, vatRate, ssclRate]);

  const priceFor = (variant: LabelVariant) =>
    labelPriceDisplay({
      retailPrice: variant.retailPrice,
      taxRule: variant.taxRule,
      vatRate,
      ssclRate,
    });

  const previewVariant =
    variants.find((variant) => variant.id === previewVariantId) ?? variants[0];
  const previewVariantPrice = previewVariant ? priceFor(previewVariant) : null;
  const a4PageCount = a4SheetPages.length;
  const safeA4PageIndex = Math.min(a4PageIndex, Math.max(0, a4PageCount - 1));
  const previewA4Page = a4SheetPages[safeA4PageIndex] ?? null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="min-w-[700px] max-w-[850px]">
          <DialogHeader>
            <DialogTitle className="font-display text-espresso">
              Print Barcode Labels
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-[1fr_300px] gap-6">
            {/* LEFT — Label preview */}
            <div className="flex flex-col gap-3 overflow-hidden rounded-lg border border-sand/30 bg-sand/10 p-4">
              {variants.length > 1 ? (
                <div className="flex flex-wrap gap-1.5">
                  {variants.map((variant) => (
                    <button
                      key={variant.id}
                      type="button"
                      aria-pressed={variant.id === previewVariant?.id}
                      data-testid="barcode-preview-variant"
                      onClick={() => setPreviewVariantId(variant.id)}
                      className={`rounded-md px-2 py-1 font-body text-xs transition-colors ${
                        variant.id === previewVariant?.id
                          ? 'bg-espresso text-pearl'
                          : 'border border-sand bg-pearl text-espresso hover:bg-sand/20'
                      }`}
                    >
                      {[variant.form, variant.packSize].filter(Boolean).join(' ') ||
                        variant.sku}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="flex min-h-[280px] items-start justify-center">
                {isA4 ? (
                  previewA4Page ? (
                    <div className="w-full max-w-[360px]">
                      <div className="mb-2 flex items-center justify-between font-body text-xs text-mist-ink">
                        <span>
                          A4 preview · page {safeA4PageIndex + 1} of {a4PageCount}
                        </span>
                        <span>
                          {previewA4Page.length} label
                          {previewA4Page.length === 1 ? '' : 's'}
                        </span>
                      </div>
                      <BarcodeSheetPage labels={previewA4Page} scale={0.4} />
                      {a4PageCount > 1 ? (
                        <div className="mt-2 flex items-center justify-between">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 border-sand px-2 text-xs"
                            disabled={safeA4PageIndex <= 0}
                            onClick={() =>
                              setA4PageIndex(Math.max(0, safeA4PageIndex - 1))
                            }
                          >
                            Previous page
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 border-sand px-2 text-xs"
                            disabled={safeA4PageIndex >= a4PageCount - 1}
                            onClick={() =>
                              setA4PageIndex(
                                Math.min(a4PageCount - 1, safeA4PageIndex + 1),
                              )
                            }
                          >
                            Next page
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ) : null
                ) : (
                  previewVariant &&
                  previewVariantPrice && (
                    <BarcodeLabel
                      brandName={previewVariant.brandName}
                      productName={previewVariant.productName}
                      sku={previewVariant.sku}
                      barcode={previewVariant.barcode}
                      form={previewVariant.form}
                      packSize={previewVariant.packSize}
                      retailPrice={previewVariantPrice.amount}
                      priceQualifier={previewVariantPrice.qualifier}
                      stockQuantity={previewVariant.stockQuantity}
                      lowStockThreshold={previewVariant.lowStockThreshold}
                      isPreview
                    />
                  )
                )}
              </div>
            </div>

            {/* RIGHT — Settings */}
            <div className="flex flex-col gap-4">
              {/* Label template selector */}
              <div>
                <span className="font-body text-xs font-medium text-espresso mb-1.5 block">
                  Label template
                </span>
                <div className="flex flex-col gap-2">
                  {BARCODE_LABEL_TEMPLATES.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={option.id === templateId}
                      className={`rounded-md px-3 py-2 text-left font-body text-xs transition-colors ${
                        option.id === templateId
                          ? 'bg-espresso text-pearl'
                          : 'bg-pearl text-espresso border border-sand'
                      }`}
                      onClick={() => setTemplateId(option.id)}
                    >
                      {option.name}
                    </button>
                  ))}
                </div>
                <p className="font-body text-xs text-mist-ink mt-1.5">
                  {barcodeLabelTemplateSummary(template)}
                </p>
                {isA4 ? (
                  <p className="font-body text-xs text-mist-ink mt-1">
                    {a4SheetPages.length} page
                    {a4SheetPages.length === 1 ? '' : 's'},{' '}
                    {BARCODE_LABELS_PER_SHEET} labels per sheet.
                  </p>
                ) : null}
              </div>

              {/* Label contents per queued variant */}
              <div>
                <span className="font-body text-xs font-medium text-espresso mb-1.5 block">
                  Label contents
                </span>
                <ul className="max-h-[120px] space-y-1 overflow-y-auto pr-1">
                  {variants.map((variant) => {
                    const price = priceFor(variant);
                    return (
                      <li
                        key={variant.id}
                        className="flex items-center justify-between gap-2 rounded border border-sand/30 bg-pearl px-2 py-1 font-body text-xs"
                      >
                        <span className="min-w-0 truncate text-espresso">
                          {variant.sku}
                          {(variant.form || variant.packSize) && (
                            <span className="text-mist-ink">
                              {' · '}
                              {[variant.form, variant.packSize]
                                .filter(Boolean)
                                .join(' ')}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-right text-espresso">
                          Rs. {price.amount.toLocaleString('en-LK', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                          <span className="ml-1 text-mist-ink">
                            ({price.qualifier})
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Quantity stepper list */}
              <div>
                <span className="font-body text-xs font-medium text-espresso mb-1.5 block">
                  Quantities
                </span>
                <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto pr-1">
                  {variants.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-sand/30 bg-pearl px-2 py-1.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-xs text-espresso truncate">
                          {v.sku}
                        </div>
                        {(v.form || v.packSize) && (
                          <div className="font-body text-xs text-mist-ink truncate">
                            {[v.form, v.packSize].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          className="flex h-6 w-6 items-center justify-center rounded border border-sand text-espresso hover:bg-sand/20 font-body text-sm"
                          onClick={() =>
                            setQty(v.id, (quantities[v.id] ?? 1) - 1)
                          }
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={quantities[v.id] ?? 1}
                          onChange={(e) =>
                            setQty(v.id, parseInt(e.target.value, 10) || 1)
                          }
                          className="h-6 w-12 rounded border border-sand bg-pearl text-center font-mono text-xs text-espresso focus:outline-none focus:ring-1 focus:ring-espresso"
                        />
                        <button
                          type="button"
                          className="flex h-6 w-6 items-center justify-center rounded border border-sand text-espresso hover:bg-sand/20 font-body text-sm"
                          onClick={() =>
                            setQty(v.id, (quantities[v.id] ?? 1) + 1)
                          }
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="font-body text-sm font-medium text-espresso">
                Total: {totalLabels} label{totalLabels !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              className="text-mist-ink"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              className="bg-espresso text-pearl hover:bg-espresso/90"
              onClick={handlePrint}
            >
              Print Labels
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
