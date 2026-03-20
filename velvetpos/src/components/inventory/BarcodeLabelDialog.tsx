'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
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

// ── Types ────────────────────────────────────────────────────────────────────

export interface LabelVariant {
  id: string;
  sku: string;
  barcode: string | null;
  size: string | null;
  colour: string | null;
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
  const printContainerRef = useRef<HTMLDivElement | null>(null);

  // Re-initialise quantities when variants change
  useEffect(() => {
    setQuantities(Object.fromEntries(variants.map((v) => [v.id, 1])));
  }, [variants]);

  const totalLabels = Object.values(quantities).reduce((a, b) => a + b, 0);

  const setQty = useCallback((id: string, value: number) => {
    const clamped = Math.max(1, Math.min(99, value));
    setQuantities((prev) => ({ ...prev, [id]: clamped }));
  }, []);

  const toNum = (v: number | string): number =>
    typeof v === 'string' ? parseFloat(v) : v;

  // ── Print ────────────────────────────────────────────────────────────────

  const handlePrint = useCallback(() => {
    // Build flat label list
    const labels: LabelVariant[] = [];
    for (const v of variants) {
      const qty = quantities[v.id] ?? 1;
      for (let i = 0; i < qty; i++) labels.push(v);
    }

    // Create print container
    const container = document.createElement('div');
    container.id = 'barcode-print-container';
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    document.body.appendChild(container);
    printContainerRef.current = container;

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
          grid-template-columns: ${paperSize === 'a4' ? 'repeat(4, 1fr)' : '1fr'};
          gap: 0;
        }
        #barcode-print-container .label-page-break {
          page-break-after: always;
        }
      }
    `;
    document.head.appendChild(style);

    // Set grid on the container itself (for rendering purposes)
    container.style.display = 'grid';
    container.style.gridTemplateColumns =
      paperSize === 'a4' ? 'repeat(4, 1fr)' : '1fr';
    container.style.gap = '0';

    // Render labels into container
    const labelsPerPage = paperSize === 'a4' ? 32 : Infinity;

    labels.forEach((v, idx) => {
      // Create a wrapper for the label
      const labelWrapper = document.createElement('div');

      // Add page break class after every page
      if (
        paperSize === 'a4' &&
        idx > 0 &&
        idx % labelsPerPage === labelsPerPage - 1
      ) {
        labelWrapper.className = 'label-page-break';
      }

      container.appendChild(labelWrapper);
    });

    // Since we can't render React components into raw DOM easily in this approach,
    // we'll use a React portal. We need to force a re-render with a flag.
    // Instead, let's use a simpler innerHTML approach with a hidden React render.
    // Actually — let's use a state-driven approach.

    // Clean up what we just did and use the state-driven portal approach instead.
    container.innerHTML = '';

    setShowPrintPortal(true);

    // After a brief delay to let React render, print
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();

        // Cleanup
        style.remove();
        container.remove();
        printContainerRef.current = null;
        setShowPrintPortal(false);
        onClose();
      });
    });
  }, [variants, quantities, paperSize, onClose]);

  // ── Portal-based print rendering ──────────────────────────────────────────

  const [showPrintPortal, setShowPrintPortal] = useState(false);

  // Ensure cleanup on unmount
  useEffect(() => {
    return () => {
      document.getElementById('barcode-print-styles')?.remove();
      document.getElementById('barcode-print-container')?.remove();
    };
  }, []);

  // Build flat labels array for portal rendering
  const printLabels: LabelVariant[] = [];
  if (showPrintPortal) {
    for (const v of variants) {
      const qty = quantities[v.id] ?? 1;
      for (let i = 0; i < qty; i++) printLabels.push(v);
    }
  }

  const labelsPerPage = paperSize === 'a4' ? 32 : Infinity;
  const firstVariant = variants[0];

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
              {firstVariant && (
                <BarcodeLabel
                  brandName={firstVariant.brandName}
                  productName={firstVariant.productName}
                  sku={firstVariant.sku}
                  barcode={firstVariant.barcode}
                  size={firstVariant.size}
                  colour={firstVariant.colour}
                  retailPrice={toNum(firstVariant.retailPrice)}
                  stockQuantity={firstVariant.stockQuantity}
                  lowStockThreshold={firstVariant.lowStockThreshold}
                  isPreview
                />
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
                  <p className="font-body text-xs text-mist mt-1.5">
                    A4 mode prints 4 labels per row, 8 rows per page — 32
                    labels per sheet.
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
                        {(v.size || v.colour) && (
                          <div className="font-body text-xs text-mist truncate">
                            {[v.size, v.colour].filter(Boolean).join(' · ')}
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
              className="text-mist"
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

      {/* Print portal — renders labels off-screen for window.print() */}
      {showPrintPortal &&
        printContainerRef.current &&
        createPortal(
          <>
            {printLabels.map((v, idx) => (
              <div
                key={`${v.id}-${idx}`}
                className={
                  paperSize === 'a4' &&
                  idx > 0 &&
                  (idx + 1) % labelsPerPage === 0
                    ? 'label-page-break'
                    : undefined
                }
              >
                <BarcodeLabel
                  brandName={v.brandName}
                  productName={v.productName}
                  sku={v.sku}
                  barcode={v.barcode}
                  size={v.size}
                  colour={v.colour}
                  retailPrice={toNum(v.retailPrice)}
                  stockQuantity={v.stockQuantity}
                  lowStockThreshold={v.lowStockThreshold}
                />
              </div>
            ))}
          </>,
          printContainerRef.current,
        )}
    </>
  );
}
