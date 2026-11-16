'use client';

import Barcode from 'react-barcode';
import { BARCODE_SHEET_COLUMNS, BARCODE_SHEET_ROWS } from '@/lib/barcode-sheet.core';

// ── Geometry ─────────────────────────────────────────────────────────────────
// CSS px at 96 dpi: A4 = 210 × 297 mm = 793.7 × 1122.5 px, and one label is
// 63.5 × 33.9 mm (the common 24-up A4 label sheet). The preview and the print
// overlay render the same component, so what the operator sees is what prints.

export const A4_WIDTH_PX = 793.7;
export const A4_HEIGHT_PX = 1122.5;
const SHEET_PADDING_PX = 18.9; // 5 mm
const LABEL_WIDTH_PX = 240; // 63.5 mm
const LABEL_HEIGHT_PX = 128; // 33.9 mm

export interface SheetLabelData {
  /** Stable key used by React; unique per printed copy (not per variant). */
  key: string;
  productName: string;
  sku: string;
  barcode: string;
  form?: string | null;
  packSize?: string | null;
  retailPrice?: number | null;
}

function formatPrice(value: number): string {
  return `Rs. ${value.toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ── Single label ─────────────────────────────────────────────────────────────

export function BarcodeSheetLabel({ label }: { label: SheetLabelData }) {
  const variantText = [label.form, label.packSize].filter(Boolean).join(' · ');

  return (
    <div
      data-testid="barcode-sheet-label"
      style={{
        width: LABEL_WIDTH_PX,
        height: LABEL_HEIGHT_PX,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '6px 8px',
        border: '1px dashed #d6c9b4',
        background: '#ffffff',
        overflow: 'hidden',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            lineHeight: 1.15,
            fontWeight: 600,
            color: '#2f2418',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {label.productName}
        </div>
        {variantText ? (
          <div
            style={{
              fontSize: 9,
              lineHeight: 1.2,
              color: '#6b5a45',
              marginTop: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {variantText}
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: 60,
          overflow: 'hidden',
        }}
      >
        <Barcode
          value={label.barcode}
          // Code 128 keeps every bar the same height (EAN-13 guard bars are
          // longer by design, which read as "some lines are longer" on the
          // printed sheet). The stored value is still EAN-13 in the catalogue.
          format="CODE128"
          width={1.25}
          height={46}
          displayValue={false}
          // Quiet zones are required for reliable scanning; `margin={0}`
          // removed them entirely.
          margin={0}
          marginLeft={10}
          marginRight={10}
          marginTop={0}
          marginBottom={0}
          renderer="svg"
        />
        <span
          data-testid="barcode-human-value"
          style={{
            marginTop: 1,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: 1,
            lineHeight: '12px',
            color: '#2f2418',
            whiteSpace: 'nowrap',
          }}
        >
          {label.barcode}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 8,
            color: '#6b5a45',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {label.sku}
        </span>
        {typeof label.retailPrice === 'number' ? (
          <span style={{ fontSize: 11, fontWeight: 700, color: '#2f2418' }}>
            {formatPrice(label.retailPrice)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ── One A4 sheet ─────────────────────────────────────────────────────────────

export function BarcodeSheetPage({
  labels,
  scale = 1,
}: {
  labels: SheetLabelData[];
  /** Preview scale. Print always uses 1. */
  scale?: number;
}) {
  return (
    <div
      data-testid="barcode-sheet-page"
      className="barcode-sheet-page"
      style={{
        width: scale === 1 ? A4_WIDTH_PX : A4_WIDTH_PX * scale,
        height: scale === 1 ? A4_HEIGHT_PX : A4_HEIGHT_PX * scale,
        flex: '0 0 auto',
      }}
    >
      <div
        style={{
          width: A4_WIDTH_PX,
          height: A4_HEIGHT_PX,
          boxSizing: 'border-box',
          padding: SHEET_PADDING_PX,
          background: '#ffffff',
          display: 'grid',
          gridTemplateColumns: `repeat(${BARCODE_SHEET_COLUMNS}, ${LABEL_WIDTH_PX}px)`,
          gridTemplateRows: `repeat(${BARCODE_SHEET_ROWS}, ${LABEL_HEIGHT_PX}px)`,
          justifyContent: 'space-between',
          alignContent: 'space-between',
          transform: scale === 1 ? undefined : `scale(${scale})`,
          transformOrigin: 'top left',
          boxShadow: scale === 1 ? undefined : '0 1px 6px rgba(47, 36, 24, 0.18)',
        }}
      >
        {labels.map((label) => (
          <BarcodeSheetLabel key={label.key} label={label} />
        ))}
      </div>
    </div>
  );
}
