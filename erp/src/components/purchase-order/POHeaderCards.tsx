'use client';

import { Card, CardContent } from '@/components/ui/card';

import { formatPoDate, poDueDay, todayIso } from './poDates';

/**
 * The four at-a-glance facts about a PO: who it is from, when it arrives, how it
 * is paid and who raised it.
 */
interface POHeaderCardsProps {
  supplierName: string;
  supplierContact?: string | null | undefined;
  expectedDeliveryDate?: string | null | undefined;
  paymentTermDays: number | null;
  paymentState?: string | undefined;
  orderDate: string;
  createdAt: string;
  createdByName: string;
}

export function POHeaderCards({
  supplierName,
  supplierContact,
  expectedDeliveryDate,
  paymentTermDays,
  paymentState,
  orderDate,
  createdAt,
  createdByName,
}: POHeaderCardsProps) {
  // ARGUS #233: show when the money is due, not when the order was raised.
  const dueDay = poDueDay(orderDate, paymentTermDays);
  const overdue = Boolean(dueDay && paymentState !== 'PAID' && dueDay < todayIso());

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardContent className="pt-6">
          <p className="text-xs text-mist-ink">Supplier</p>
          <p className="font-medium text-espresso">{supplierName}</p>
          {supplierContact ? <p className="text-sm text-mist-ink">{supplierContact}</p> : null}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <p className="text-xs text-mist-ink">Expected Delivery</p>
          <p className="font-medium text-espresso">{formatPoDate(expectedDeliveryDate)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <p className="text-xs text-mist-ink">Payment Terms</p>
          <p className="font-medium text-espresso">
            {paymentTermDays === null ? 'Immediate' : `${paymentTermDays} days`}
          </p>
          <p className="text-xs text-mist-ink">
            {paymentTermDays === null
              ? `Due on receipt (${formatPoDate(orderDate)})`
              : dueDay
                ? `Due ${formatPoDate(dueDay)}`
                : `Due ${paymentTermDays} days after the order date`}
          </p>
          {overdue ? (
            <p className="text-xs font-medium text-amber-700">Overdue</p>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <p className="text-xs text-mist-ink">Created</p>
          <p className="font-medium text-espresso">{formatPoDate(createdAt)}</p>
          <p className="text-xs text-mist-ink">by {createdByName}</p>
        </CardContent>
      </Card>
    </div>
  );
}
