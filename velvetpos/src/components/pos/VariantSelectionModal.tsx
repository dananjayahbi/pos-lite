'use client';

import { useState, useEffect, useMemo } from 'react';
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

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    null,
  );
  const [hoveredVariantId, setHoveredVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const addItem = useCartStore((s) => s.addItem);

  // Reset state when productId changes
  useEffect(() => {
    setSelectedVariantId(null);
    setHoveredVariantId(null);
    setQuantity(1);
  }, [productId]);

  const cachedData = queryClient.getQueryData<{ data: ProductListItem[] }>([
    'pos-products',
  ]);
  const product =
    cachedData?.data?.find((p) => p.id === productId) ?? null;

  const variants = product?.variants ?? [];

  const sizes = useMemo(
    () => [...new Set(variants.map((v) => v.size).filter(Boolean))] as string[],
    [variants],
  );
  const colours = useMemo(
    () =>
      [...new Set(variants.map((v) => v.colour).filter(Boolean))] as string[],
    [variants],
  );

  const isMatrixMode = sizes.length >= 2 && colours.length >= 2;

  // Determine axis orientation: fewer distinct values as columns
  const colourAsCols = colours.length <= sizes.length;
  const rowAxis = isMatrixMode
    ? colourAsCols
      ? 'size'
      : 'colour'
    : null;
  const rowValues = isMatrixMode
    ? colourAsCols
      ? sizes
      : colours
    : null;
  const colValues = isMatrixMode
    ? colourAsCols
      ? colours
      : sizes
    : null;

  const findVariant = (
    rowValue: string,
    colValue: string,
  ): VariantItem | undefined => {
    return variants.find((v) => {
      if (rowAxis === 'size')
        return v.size === rowValue && v.colour === colValue;
      return v.colour === rowValue && v.size === colValue;
    });
  };

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
                    <Image
                      src={thumbnail}
                      alt={product.name}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
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
                {/* Quantity stepper */}
                <div className="inline-flex items-center rounded-md border border-mist">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="flex h-8 w-8 items-center justify-center text-espresso hover:bg-sand disabled:opacity-50"
                    disabled={quantity <= 1}
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
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Custom close button */}
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-mist hover:bg-sand hover:text-espresso"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </button>
              </div>
            </DialogHeader>

            {/* Variant selection */}
            <div className="mt-1">
              {isMatrixMode && rowValues && colValues ? (
                <div
                  className="grid gap-1.5"
                  style={{
                    gridTemplateColumns: `auto repeat(${colValues.length}, 1fr)`,
                  }}
                >
                  {/* Column headers */}
                  <div /> {/* empty top-left cell */}
                  {colValues.map((col) => (
                    <div
                      key={col}
                      className="flex items-center justify-center font-body text-xs text-mist py-1"
                    >
                      {col}
                    </div>
                  ))}
                  {/* Rows */}
                  {rowValues.map((row) => (
                    <>
                      <div
                        key={`row-${row}`}
                        className="flex items-center font-body text-xs text-mist pr-2"
                      >
                        {row}
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
                            onHover={() =>
                              setHoveredVariantId(variant?.id ?? null)
                            }
                            onLeave={() => setHoveredVariantId(null)}
                          />
                        );
                      })}
                    </>
                  ))}
                </div>
              ) : (
                /* Single-axis / flat chip mode */
                <div className="flex flex-wrap gap-2">
                  {variants.map((variant) => {
                    const label =
                      variant.size ?? variant.colour ?? variant.sku;
                    const inStock = variant.stockQuantity > 0;
                    const lowStock =
                      variant.stockQuantity > 0 &&
                      variant.stockQuantity <= 10;
                    const isSelected = variant.id === selectedVariantId;

                    return (
                      <button
                        key={variant.id}
                        type="button"
                        disabled={!inStock}
                        onClick={() => setSelectedVariantId(variant.id)}
                        onMouseEnter={() => setHoveredVariantId(variant.id)}
                        onMouseLeave={() => setHoveredVariantId(null)}
                        className={`relative rounded-full px-4 py-2 font-body text-sm transition-colors ${
                          isSelected
                            ? 'bg-espresso text-pearl border-2 border-sand'
                            : inStock
                              ? 'bg-white border border-mist hover:bg-sand hover:border-espresso'
                              : 'bg-gray-100 opacity-50 cursor-not-allowed line-through'
                        }`}
                      >
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
                <span className="font-mono text-mist">
                  SKU: {displayVariant.sku}
                </span>
                <StockLabel
                  stockQuantity={displayVariant.stockQuantity}
                />
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
                  variantDescription: [selectedVariant.size, selectedVariant.colour].filter(Boolean).join(' / ') || 'Default',
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
              Add {quantity} to Cart
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
    return <div className="h-14 rounded-md bg-gray-50" />;
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
      className={`relative h-14 w-full rounded-md font-body text-xs transition-colors ${
        isSelected
          ? 'bg-espresso text-pearl border-2 border-sand'
          : inStock
            ? 'bg-white border border-mist hover:bg-sand hover:border-espresso'
            : 'bg-gray-100 opacity-50 cursor-not-allowed'
      }`}
    >
      {!inStock && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-px w-[80%] rotate-[-20deg] bg-mist" />
        </div>
      )}
      {lowStock && !isSelected && (
        <span className="absolute top-0.5 right-1 text-[10px] font-mono text-[#B7791F]">
          {variant.stockQuantity}
        </span>
      )}
    </button>
  );
}

function StockLabel({ stockQuantity }: { stockQuantity: number }) {
  if (stockQuantity === 0) {
    return <span className="font-body text-[#9B2226]">Out of stock</span>;
  }
  if (stockQuantity <= 10) {
    return (
      <span className="font-body text-[#B7791F]">
        {stockQuantity} left
      </span>
    );
  }
  return (
    <span className="font-body text-mist">
      {stockQuantity} in stock
    </span>
  );
}
