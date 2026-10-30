'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRupee } from '@/lib/format';

import type { PODiscountType } from './poTypes';

/**
 * Persisted subtotal → discount → payable for a saved purchase order.
 *
 * Deliberately reads the stored figures rather than recomputing: this is what
 * the server actually recorded, which is the number to reconcile against.
 */
interface POTotalsCardProps {
  subtotal: string | number;
  discountType: PODiscountType | null;
  discountValue: string | number;
  discountAmount: string | number;
  total: string | number;
}

export function POTotalsCard({
  subtotal,
  discountType,
  discountValue,
  discountAmount,
  total,
}: POTotalsCardProps) {
  const percent = Number(discountValue);
  const discountLabel =
    discountType === 'PERCENTAGE' && percent > 0
      ? `Discount (${percent}%)`
      : discountType === 'FIXED'
        ? 'Discount (fixed)'
        : 'Discount';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Totals</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-sand/30 bg-linen/50 px-3 py-2">
            <dt className="text-xs text-mist">Subtotal</dt>
            <dd className="font-mono text-sm text-espresso">{formatRupee(subtotal)}</dd>
          </div>
          <div className="rounded-lg border border-sand/30 bg-linen/50 px-3 py-2">
            <dt className="text-xs text-mist">{discountLabel}</dt>
            <dd className="font-mono text-sm text-espresso">
              {Number(discountAmount) > 0 ? `− ${formatRupee(discountAmount)}` : '—'}
            </dd>
          </div>
          <div className="rounded-lg border border-sand/30 bg-pearl px-3 py-2">
            <dt className="text-xs text-mist">Total payable</dt>
            <dd className="font-mono text-sm font-semibold text-espresso">{formatRupee(total)}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
