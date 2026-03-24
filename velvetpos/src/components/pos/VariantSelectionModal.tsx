'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { X, Minus, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { formatRupee } from '@/lib/format';
import { resolveDisplayColor } from '@/lib/colorUtils';
import { useCartStore } from '@/stores/cartStore';
import type { ProductListItem } from '@/hooks/useProducts';

interface VariantSelectionModalProps {
  productId: string | null;
  onClose: () => void;
}

type VariantItem = NonNullable<ProductListItem['variants']>[number];

export function VariantSelectionModal({
  productId,
  onClose,
}: VariantSelectionModalProps) {
  const queryClient = useQueryClient();

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [hoveredVariantId, setHoveredVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const addItem = useCartStore((s) => s.addItem);

  useEffect(() => {
    setSelectedVariantId(null);
    setHoveredVariantId(null);
    setQuantity(1);
  }, [productId]);

  const cachedData = queryClient.getQueryData<{ data: ProductListItem[] }>(['pos-products']);
  const product = cachedData?.data?.find((p) => p.id === productId) ?? null;
  const variants = product?.variants ?? [];

  const sizes = useMemo(
    () => [...new Set(variants.map((v) => v.size).filter(Boolean))] as string[],
    [variants],
  );
  const colours = useMemo(
    () => [...new Set(variants.map((v) => v.colour).filter(Boolean))] as string[],
    [variants],
  );

  const isMatrixMode = sizes.length >= 2 && colours.length >= 2;
  const colourAsCols = colours.length <= sizes.length;
  const rowAxis = isMatrixMode ? (colourAsCols ? 'size' : 'colour') : null;
  const rowValues = isMatrixMode ? (colourAsCols ? sizes : colours) : null;
  const colValues = isMatrixMode ? (colourAsCols ? colours : sizes) : null;

  const findVariant = (rowValue: string, colValue: string): VariantItem | undefined =>
    variants.find((v) => {
      if (rowAxis === 'size') return v.size === rowValue && v.colour === colValue;
      return v.colour === rowValue && v.size === colValue;
    });

  const selectedVariant = variants.find((v) => v.id === selectedVariantId);
  const hoveredVariant = variants.find((v) => v.id === hoveredVariantId);
  const displayVariant = hoveredVariant ?? selectedVariant ?? variants[0];
  const thumbnail = displayVariant?.imageUrls?.[0];

  const variantDescriptor = selectedVariant
    ? [selectedVariant.size, selectedVariant.colour].filter(Boolean).join(' / ')
    : '';

  return (
    <Dialog open={productId !== null} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        {product && (
          <>
            {/* Header */}
            <DialogHeader className="flex-row items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {thumbnail && (
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-mist">
                    <Image src={thumbnail} alt={product.name} fill className="object-cover" sizes="64px" />
                  </div>
                )}
                <div className="min-w-0">
                  <DialogTitle className="font-display text-lg text-espresso truncate">
                    {product.name}
                  </DialogTitle>
                  {displayVariant && (
                    <p className="font-mono text-lg text-terracotta">
                      {formatRupee(displayVariant.retailPrice)}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="inline-flex items-center rounded-md border border-mist">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="flex h-8 w-8 items-center justify-center text-espresso hover:bg-sand disabled:opacity-50"
                    disabled={quantity <= 1}
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="flex h-8 w-8 items-center justify-center font-mono text-sm text-espresso">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                    className="flex h-8 w-8 items-center justify-center text-espresso hover:bg-sand disabled:opacity-50"
                    disabled={quantity >= 99}
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-terracotta/60 hover:bg-sand hover:text-espresso"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </DialogHeader>

            {/* Variant selection */}
            <div className="mt-1">
              {isMatrixMode && rowValues && colValues ? (
                /* Matrix grid: row axis (sizes) × column axis (colours) */
                <div
                  className="grid gap-1.5"
                  style={{ gridTemplateColumns: `auto repeat(${colValues.length}, 1fr)` }}
                >
                  {/* Empty top-left corner */}
                  <div />
                  {/* Column headers */}
                  {colValues.map((col) => (
                    <div key={col} className="flex items-center justify-center px-1 py-1 text-center">
                      <span className="font-body text-xs font-semibold text-espresso/70 leading-tight break-words">
                        {col}
                      </span>
                    </div>
                  ))}
                  {/* Rows */}
                  {rowValues.map((row) => (
                    <Fragment key={`row-${row}`}>
                      <div className="flex items-center pr-2">
                        <span className="font-body text-xs font-semibold text-espresso/70">{row}</span>
                      </div>
                      {colValues.map((col) => {
                        const variant = findVariant(row, col);
                        return (
                          <VariantCell
                            key={`${row}-${col}`}
                            variant={variant}
                            isSelected={variant?.id === selectedVariantId}
                            onSelect={() => {
                              if (variant && variant.stockQuantity > 0)
                                setSelectedVariantId(variant.id);
                            }}
                            onHover={() => setHoveredVariantId(variant?.id ?? null)}
                            onLeave={() => setHoveredVariantId(null)}
                          />
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
              ) : (
                /* Single-axis: flat chip list */
                <div className="flex flex-wrap gap-2">
                  {variants.map((variant) => {
                    const parts = [variant.size, variant.colour].filter(Boolean);
                    const label = parts.length > 0 ? parts.join(' / ') : variant.sku;
                    const inStock = variant.stockQuantity > 0;
                    const lowStock = variant.stockQuantity > 0 && variant.stockQuantity <= 10;
                    const isSelected = variant.id === selectedVariantId;

                    return (
                      <button
                        key={variant.id}
                        type="button"
                        disabled={!inStock}
                        onClick={() => setSelectedVariantId(variant.id)}
                        onMouseEnter={() => setHoveredVariantId(variant.id)}
                        onMouseLeave={() => setHoveredVariantId(null)}
                        className={`relative inline-flex items-center gap-2 rounded-full px-4 py-2 font-body text-sm transition-colors ${
                          isSelected
                            ? 'bg-espresso text-pearl border-2 border-sand'
                            : inStock
                              ? 'bg-linen text-espresso border border-mist hover:bg-sand hover:border-espresso'
                              : 'bg-linen/50 text-espresso/40 cursor-not-allowed line-through border border-mist/50'
                        }`}
                      >
                        {resolveDisplayColor(variant.colour) && (
                          <span
                            className="inline-block h-4 w-4 rounded-full border border-black/10 shadow-sm shrink-0"
                            style={{ backgroundColor: resolveDisplayColor(variant.colour) ?? undefined }}
                          />
                        )}
                        {label}
                        {lowStock && !isSelected && (
                          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-white text-[10px] font-mono text-[#B7791F] border border-[#B7791F]">
                            {variant.stockQuantity}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SKU & Stock info */}
            {displayVariant && (
              <div className="flex items-center justify-between text-[11px] mt-1">
                <span className="font-mono text-terracotta/60">SKU: {displayVariant.sku}</span>
                <StockLabel stockQuantity={displayVariant.stockQuantity} />
              </div>
            )}

            {/* Add to Cart */}
            <button
              type="button"
              disabled={!selectedVariant}
              onClick={() => {
                if (!selectedVariant) return;
                addItem({
                  variantId: selectedVariant.id,
                  productName: product.name,
                  variantDescription:
                    [selectedVariant.size, selectedVariant.colour].filter(Boolean).join(' / ') || 'Default',
                  sku: selectedVariant.sku,
                  unitPrice: Number(selectedVariant.retailPrice),
                  quantity,
                });
                toast.success(
                  `Added ${quantity}× ${product.name} ${[selectedVariant.size, selectedVariant.colour].filter(Boolean).join(' / ')} to cart`,
                );
                onClose();
              }}
              className="w-full bg-espresso text-pearl font-body py-2.5 rounded-lg hover:bg-espresso/90 disabled:opacity-50"
            >
              {selectedVariant ? `Add ${quantity} to Cart — ${variantDescriptor}` : 'Select a variant'}
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─── Sub-components ─── */

function VariantCell({
  variant,
  isSelected,
  onSelect,
  onHover,
  onLeave,
}: {
  variant: VariantItem | undefined;
  isSelected: boolean;
  onSelect: () => void;
  onHover: () => void;
  onLeave: () => void;
}) {
  if (!variant) {
    // No variant for this combination
    return <div className="h-12 rounded-md bg-linen/30 border border-dashed border-mist/40" />;
  }

  const inStock = variant.stockQuantity > 0;
  const lowStock = variant.stockQuantity > 0 && variant.stockQuantity <= 10;

  return (
    <button
      type="button"
      disabled={!inStock}
      onClick={onSelect}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={`relative h-12 w-full rounded-md font-body text-xs font-medium transition-all ${
        isSelected
          ? 'bg-espresso text-pearl border-2 border-sand shadow-sm'
          : inStock
            ? 'bg-linen text-espresso border border-mist hover:bg-sand hover:border-espresso'
            : 'bg-linen/30 text-espresso/30 border border-dashed border-mist/40 cursor-not-allowed'
      }`}
    >
      {/* Color dot – top-right corner */}
      {resolveDisplayColor(variant.colour) && (
        <span
          className="absolute top-1 right-1 h-4 w-4 rounded-full border border-black/10 shadow-sm pointer-events-none"
          style={{ backgroundColor: resolveDisplayColor(variant.colour) ?? undefined }}
        />
      )}
      {!inStock && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-px w-[70%] rotate-[-15deg] bg-mist/60" />
        </div>
      )}
      {inStock && (
        <span className="text-[11px]">
          {inStock ? formatRupee(variant.retailPrice) : ''}
        </span>
      )}
      {lowStock && !isSelected && inStock && (
        <span className="absolute top-0.5 left-1 text-[9px] font-mono text-[#B7791F]">
          {variant.stockQuantity}
        </span>
      )}
    </button>
  );
}

function StockLabel({ stockQuantity }: { stockQuantity: number }) {
  if (stockQuantity === 0) return <span className="font-body text-[#9B2226]">Out of stock</span>;
  if (stockQuantity <= 10) return <span className="font-body text-[#B7791F]">{stockQuantity} left</span>;
  return <span className="font-body text-terracotta/60">{stockQuantity} in stock</span>;
}
