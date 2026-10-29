'use client';

import type { ReactNode } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRupee } from '@/lib/format';
import { computePurchaseOrderTotals } from '@/lib/services/purchaseOrderTotals';

import { addDays, formatPoDate } from './poDates';
import type { PODiscountType } from './poTypes';

/**
 * Live subtotal → discount → payable summary.
 *
 * The arithmetic comes from `computePurchaseOrderTotals` — the same function the
 * API uses to persist the totals — so the preview can never disagree with what
 * the server stores.
 */

export interface SummaryLine {
  label: string;
  qty: number;
  unitCost: number;
}

interface POSummaryPanelProps {
  lines: SummaryLine[];
  discountType: PODiscountType | null;
  /** Raw input string; parsed here so half-typed values are tolerated. */
  discountValue: string;
  /** Local `yyyy-mm-dd` order date, used to derive the due date. */
  orderDate?: string | undefined;
  paymentTermDays?: number | null | undefined;
  /** Rendered under the totals — the create/draft/cancel actions. */
  footer?: ReactNode;
  title?: string;
}

export function POSummaryPanel({
  lines,
  discountType,
  discountValue,
  orderDate,
  paymentTermDays,
  footer,
  title = 'Summary',
}: POSummaryPanelProps) {
  const parsedDiscount = Number.parseFloat(discountValue);
  const totals = computePurchaseOrderTotals(
    lines.map((line) => ({ orderedQty: line.qty, unitCost: line.unitCost })),
    {
      discountType: discountType,
      discountValue: Number.isFinite(parsedDiscount) ? parsedDiscount : 0,
    },
  );

  const dueDay =
    orderDate && paymentTermDays !== null && paymentTermDays !== undefined
      ? addDays(orderDate, paymentTermDays)
      : undefined;

  return (
    <Card className="sticky top-6">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {lines.length === 0 ? (
          <p className="text-sm text-mist">No lines added</p>
        ) : (
          <div className="space-y-2">
            {lines.map((line, index) => (
              <div
                key={`${line.label}-${index}`}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="min-w-0 flex-1 truncate text-espresso">{line.label}</span>
                <span className="shrink-0 font-mono text-xs text-mist">
                  {line.qty} × {formatRupee(line.unitCost)}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-1.5 border-t border-sand/30 pt-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-mist">Subtotal</span>
            <span className="font-mono text-espresso">{formatRupee(totals.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-mist">
              Discount
              {discountType === 'PERCENTAGE' && totals.discountAmount > 0
                ? ` (${discountValue || 0}%)`
                : ''}
            </span>
            <span className="font-mono text-espresso">
              {totals.discountAmount > 0 ? `− ${formatRupee(totals.discountAmount)}` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-sand/30 pt-2 text-base font-semibold">
            <span className="text-espresso">Total payable</span>
            <span className="font-mono text-espresso">{formatRupee(totals.total)}</span>
          </div>
        </div>

        <div className="rounded-lg bg-linen/60 px-3 py-2 text-xs text-mist">
          {paymentTermDays === null || paymentTermDays === undefined ? (
            <span>Payment: immediate</span>
          ) : (
            <span>
              Payment: {paymentTermDays} days
              {dueDay ? ` · due ${formatPoDate(dueDay)}` : ''}
            </span>
          )}
        </div>

        {footer}
      </CardContent>
    </Card>
  );
}
