'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
  BARCODE_LABELS_PER_SHEET,
  BARCODE_SHEET_COLUMNS,
  BARCODE_SHEET_ROWS,
  paginateBarcodeSheet,
} from '@/lib/barcode-sheet.core';
import { PRINT_OVERLAY_CLASS, renderPrintOverlay } from '@/lib/print-overlay';

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
  productName: string;
}

interface BarcodeLabelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  variants: LabelVariant[];
}

type PaperSize = 'thermal' | 'a4';

const toNum = (v: number | string): number =>
  typeof v === 'string' ? parseFloat(v) : v;

// ── Component ────────────────────────────────────────────────────────────────

export function BarcodeLabelDialog({
  isOpen,
  onClose,
  variants,
}: BarcodeLabelDialogProps) {
  const [paperSize, setPaperSize] = useState<PaperSize>('thermal');
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(variants.map((v) => [v.id, 1])),
  );
  // Thermal print target. State (not a ref) so the portal re-renders when the
  // off-screen container exists; refs must not be read during render.
  const [printContainer, setPrintContainer] = useState<HTMLDivElement | null>(
    null,
  );

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
      page.map((entry, index) => ({
        key: `${entry.variant.id}-${index}`,
        productName: entry.variant.productName,
        sku: entry.variant.sku,
        barcode: entry.variant.barcode ?? entry.variant.sku,
        form: entry.variant.form,
        packSize: entry.variant.packSize,
        retailPrice: toNum(entry.variant.retailPrice),
      })),
    );
  }, [variants, quantities]);

  // ── Print ────────────────────────────────────────────────────────────────

  const handlePrint = useCallback(() => {
    if (paperSize === 'a4') {
      if (a4SheetPages.length === 0) return;

      // One fixed-size A4 sheet per page, explicit page breaks — never rely on
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

    // Thermal mode: one 4 × 6 cm label per row on a continuous roll.
    // Create print container
    const container = document.createElement('div');
    container.id = 'barcode-print-container';
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    document.body.appendChild(container);
    setPrintContainer(container);

    // Inject print styles
    const style = document.createElement('style');
    style.id = 'barcode-print-styles';
    style.textContent = `
      @media print {
        body > *:not(#barcode-print-container) {
          display: none !important;
          visibility: hidden !important;
        }
        #barcode-print-container {
          display: grid !important;
          position: static !important;
          left: auto !important;
          top: auto !important;
          visibility: visible !important;
          grid-template-columns: 1fr;
          gap: 0;
        }
      }
    `;
    document.head.appendChild(style);

    // Set grid on the container itself (for rendering purposes)
    container.style.display = 'grid';
    container.style.gridTemplateColumns = '1fr';
    container.style.gap = '0';

    // After a brief delay to let React render, print
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();

        // Cleanup
        style.remove();
        container.remove();
        setPrintContainer(null);
        onClose();
      });
    });
  }, [paperSize, a4SheetPages, onClose]);

  // ── Portal-based print rendering ──────────────────────────────────────────

  // Ensure cleanup on unmount
  useEffect(() => {
    return () => {
      document.getElementById('barcode-print-styles')?.remove();
      document.getElementById('barcode-print-container')?.remove();
    };
  }, []);

  // Build flat labels array for portal rendering
  const printLabels: LabelVariant[] = [];
  if (printContainer) {
    for (const v of variants) {
      const qty = quantities[v.id] ?? 1;
      for (let i = 0; i < qty; i++) printLabels.push(v);
    }
  }

  const firstVariant = variants[0];
  const firstA4Page = a4SheetPages[0];

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
            <div className="flex items-start justify-center overflow-hidden rounded-lg border border-sand/30 bg-sand/10 p-6">
              {paperSize === 'a4' ? (
                firstA4Page ? (
                  <div className="w-full max-w-[360px]">
                    <div className="mb-2 flex items-center justify-between font-body text-xs text-mist-ink">
                      <span>A4 preview · page 1</span>
                      <span>
                        {a4SheetPages.length} page
                        {a4SheetPages.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <BarcodeSheetPage labels={firstA4Page} scale={0.4} />
                  </div>
                ) : null
              ) : (
                firstVariant && (
                  <BarcodeLabel
                    brandName={firstVariant.brandName}
                    productName={firstVariant.productName}
                    sku={firstVariant.sku}
                    barcode={firstVariant.barcode}
                    form={firstVariant.form}
                    packSize={firstVariant.packSize}
                    retailPrice={toNum(firstVariant.retailPrice)}
                    stockQuantity={firstVariant.stockQuantity}
                    lowStockThreshold={firstVariant.lowStockThreshold}
                    isPreview
                  />
                )
              )}
            </div>

            {/* RIGHT — Settings */}
            <div className="flex flex-col gap-4">
              {/* Paper size selector */}
              <div>
                <span className="font-body text-xs font-medium text-espresso mb-1.5 block">
                  Paper Size
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={`flex-1 rounded-md px-3 py-2 font-body text-xs transition-colors ${
                      paperSize === 'thermal'
                        ? 'bg-espresso text-pearl'
                        : 'bg-pearl text-espresso border border-sand'
                    }`}
                    onClick={() => setPaperSize('thermal')}
                  >
                    Thermal (4 × 6 cm)
                  </button>
                  <button
                    type="button"
                    className={`flex-1 rounded-md px-3 py-2 font-body text-xs transition-colors ${
                      paperSize === 'a4'
                        ? 'bg-espresso text-pearl'
                        : 'bg-pearl text-espresso border border-sand'
                    }`}
                    onClick={() => setPaperSize('a4')}
                  >
                    A4 Sheet
                  </button>
                </div>
                {paperSize === 'a4' && (
                  <p className="font-body text-xs text-mist-ink mt-1.5">
                    A4 mode prints {BARCODE_SHEET_COLUMNS} labels per row,{' '}
                    {BARCODE_SHEET_ROWS} rows per page - {BARCODE_LABELS_PER_SHEET}{' '}
                    labels (63.5 × 33.9 mm) per sheet.
                  </p>
                )}
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

      {/* Print portal — renders thermal labels off-screen for window.print() */}
      {printContainer &&
        createPortal(
          <>
            {printLabels.map((v, idx) => (
              <div key={`${v.id}-${idx}`}>
                <BarcodeLabel
                  brandName={v.brandName}
                  productName={v.productName}
                  sku={v.sku}
                  barcode={v.barcode}
                  form={v.form}
                  packSize={v.packSize}
                  retailPrice={toNum(v.retailPrice)}
                  stockQuantity={v.stockQuantity}
                  lowStockThreshold={v.lowStockThreshold}
                />
              </div>
            ))}
          </>,
          printContainer,
        )}
    </>
  );
}
