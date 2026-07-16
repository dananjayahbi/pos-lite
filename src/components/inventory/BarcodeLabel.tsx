'use client';

import Barcode from 'react-barcode';

// ── Types ────────────────────────────────────────────────────────────────────

interface BarcodeLabelProps {
  brandName?: string | null | undefined;
  productName: string;
  sku: string;
  barcode?: string | null | undefined;
  size?: string | null | undefined;
  colour?: string | null | undefined;
  retailPrice: number;
  stockQuantity: number;
  lowStockThreshold: number;
  isPreview?: boolean | undefined;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(value: number): string {
  return `Rs. ${value.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Component ────────────────────────────────────────────────────────────────

export function BarcodeLabel({
  brandName,
  productName,
  sku,
  barcode,
  size,
  colour,
  retailPrice,
  stockQuantity,
  lowStockThreshold,
  isPreview = false,
}: BarcodeLabelProps) {
  const barcodeValue = barcode || sku;
  const hasBarcodeValue = barcodeValue.length > 0;
  const isLowStock = stockQuantity <= lowStockThreshold && stockQuantity >= 0;

  const sizeColourParts: string[] = [];
  if (size) sizeColourParts.push(`Size: ${size}`);
  if (colour) sizeColourParts.push(`Colour: ${colour}`);
  const sizeColourText = sizeColourParts.join(' · ');

  if (isPreview) {
    return (
      <div
        className="flex flex-col border border-espresso bg-mist/20 p-2"
        style={{
          width: 160,
          height: 240,
          transform: 'scale(1.5)',
          transformOrigin: 'top left',
          boxSizing: 'border-box',
        }}
      >
        <LabelContent
          brandName={brandName}
          productName={productName}
          sku={sku}
          barcodeValue={barcodeValue}
          hasBarcodeValue={hasBarcodeValue}
          sizeColourText={sizeColourText}
          retailPrice={retailPrice}
          isLowStock={isLowStock}
        />
      </div>
    );
  }

  return (
    <div
      className="barcode-label flex flex-col p-2"
      style={{
        width: '4cm',
        height: '6cm',
        boxSizing: 'border-box',
      }}
    >
      <LabelContent
        brandName={brandName}
        productName={productName}
        sku={sku}
        barcodeValue={barcodeValue}
        hasBarcodeValue={hasBarcodeValue}
        sizeColourText={sizeColourText}
        retailPrice={retailPrice}
        isLowStock={isLowStock}
      />
    </div>
  );
}

// ── Inner content (shared between preview and print) ─────────────────────────

function LabelContent({
  brandName,
  productName,
  sku,
  barcodeValue,
  hasBarcodeValue,
  sizeColourText,
  retailPrice,
  isLowStock,
}: {
  brandName?: string | null | undefined;
  productName: string;
  sku: string;
  barcodeValue: string;
  hasBarcodeValue: boolean;
  sizeColourText: string;
  retailPrice: number;
  isLowStock: boolean;
}) {
  return (
    <>
      {/* Brand name */}
      {brandName && (
        <span className="font-body text-[8px] text-espresso text-left leading-tight">
          {brandName}
        </span>
      )}

      {/* Horizontal rule */}
      <hr className="my-0.5 border-t border-mist" />

      {/* Product name */}
      <span className="font-display text-[11px] text-espresso text-left leading-tight line-clamp-2">
        {productName}
      </span>

      {/* SKU */}
      <div className="font-mono text-[9px] mt-0.5">
        <span className="text-mist">SKU:</span>{' '}
        <span className="text-espresso">{sku}</span>
      </div>

      {/* Size & Colour */}
      {sizeColourText && (
        <span className="font-body text-[8px] text-mist leading-tight">
          {sizeColourText}
        </span>
      )}

      {/* Barcode */}
      <div className="flex-1 flex items-center justify-center mt-1">
        {hasBarcodeValue ? (
          <Barcode
            value={barcodeValue}
            format="CODE128"
            width={1.5}
            height={40}
            displayValue={false}
            margin={4}
            renderer="svg"
          />
        ) : (
          <span className="font-body text-[8px] text-mist italic">
            No barcode available
          </span>
        )}
      </div>

      {/* 4px gap */}
      <div style={{ height: 4 }} />

      {/* Price row */}
      <div className="flex items-center justify-end">
        {isLowStock && (
          <span
            className="mr-auto inline-block rounded-full"
            style={{ width: 8, height: 8, backgroundColor: '#B7791F' }}
          />
        )}
        <span className="font-display text-[14px] font-bold text-espresso text-right">
          {formatPrice(retailPrice)}
        </span>
      </div>
    </>
  );
}
