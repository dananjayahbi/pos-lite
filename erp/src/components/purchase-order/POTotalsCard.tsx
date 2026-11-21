'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRupee } from '@/lib/format';

import type { PODiscountType } from './poTypes';

/**
 * Persisted subtotal -> discount -> payable for a saved purchase order.
 *
 * Once goods are received the card shows the received value and the payable
 * derived from the actual invoice (ARGUS #225); before that it shows the
 * expected order totals.
 */
interface POTotalsCardProps {
  subtotal: string | number;
  discountType: PODiscountType | null;
  discountValue: string | number;
  discountAmount: string | number;
  total: string | number;
  /** Received value and payable once goods arrive (ARGUS #225). */
  receivedValue?: string | number | undefined;
  payable?: string | number | undefined;
}

export function POTotalsCard({
  subtotal,
  discountType,
  discountValue,
  discountAmount,
  total,
  receivedValue,
  payable,
}: POTotalsCardProps) {
  const percent = Number(discountValue);
  const discountLabel =
    discountType === 'PERCENTAGE' && percent > 0
      ? `Discount (${percent}%)`
      : discountType === 'FIXED'
        ? 'Discount (fixed)'
        : 'Discount';

  const hasReceipts = Number(receivedValue ?? 0) > 0;
  const displayedSubtotal = hasReceipts ? receivedValue! : subtotal;
  const displayedDiscount = hasReceipts
    ? Math.max(0, Number(receivedValue) - Number(payable ?? total))
    : Number(discountAmount);
  const displayedTotal = hasReceipts ? (payable ?? total) : total;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Totals</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-sand/30 bg-linen/50 px-3 py-2">
            <dt className="text-xs text-mist-ink">
              {hasReceipts ? 'Received value' : 'Subtotal'}
            </dt>
            <dd className="font-mono text-sm text-espresso">{formatRupee(displayedSubtotal)}</dd>
          </div>
          <div className="rounded-lg border border-sand/30 bg-linen/50 px-3 py-2">
            <dt className="text-xs text-mist-ink">{discountLabel}</dt>
            <dd className="font-mono text-sm text-espresso">
              {displayedDiscount > 0 ? `- ${formatRupee(displayedDiscount)}` : '-'}
            </dd>
          </div>
          <div className="rounded-lg border border-sand/30 bg-pearl px-3 py-2">
            <dt className="text-xs text-mist-ink">Total payable</dt>
            <dd className="font-mono text-sm font-semibold text-espresso">
              {formatRupee(displayedTotal)}
            </dd>
          </div>
        </dl>
        {hasReceipts ? (
          <p className="mt-2 text-xs text-mist-ink">
            Based on the received quantities and actual costs. Expected order total:{' '}
            {formatRupee(total)}.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
