/**
 * ARGUS #41 — Recent Sales payment label.
 *
 * A zero-total sale settled by bank transfer stores `paymentMethod = NONE` and
 * `zeroValueReason = BANK_PAYMENT` with no payment legs, so the dashboard used
 * to print "NONE" and look unpaid. Prefer the persisted payment legs when they
 * exist; otherwise use the sale's tender/zero-value reason with explicit labels.
 */

type Decimalish = { toString(): string } | number | string;

export interface RecentSalePaymentLeg {
  method: string;
  amount: Decimalish;
}

export interface RecentSalePaymentInput {
  paymentMethod?: string | null | undefined;
  totalAmount?: Decimalish | null | undefined;
  zeroValueReason?: string | null | undefined;
  payments?: readonly RecentSalePaymentLeg[] | undefined;
}

export type RecentSalePaymentTone =
  | 'cash'
  | 'card'
  | 'bank'
  | 'qr'
  | 'credit'
  | 'split'
  | 'zero'
  | 'neutral';

export interface RecentSalePaymentSummary {
  label: string;
  tone: RecentSalePaymentTone;
}

const METHOD_LABELS: Record<string, RecentSalePaymentSummary> = {
  CASH: { label: 'Cash', tone: 'cash' },
  CARD: { label: 'Card', tone: 'card' },
  LANKAQR: { label: 'LankaQR', tone: 'qr' },
  STORE_CREDIT: { label: 'Store Credit', tone: 'credit' },
  EXCHANGE_CREDIT: { label: 'Exchange Credit', tone: 'credit' },
};

const ZERO_VALUE_LABELS: Record<string, RecentSalePaymentSummary> = {
  BANK_PAYMENT: { label: 'Bank payment', tone: 'bank' },
  PRODUCT_REPLACEMENT: { label: 'Zero-value (replacement)', tone: 'zero' },
  COMPLIMENTARY_GIFT: { label: 'Zero-value (complimentary)', tone: 'zero' },
};

function amountOf(value: Decimalish | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? parsed : 0;
}

function labelForMethod(method: string | null | undefined): RecentSalePaymentSummary | null {
  if (!method || method === 'NONE') return null;
  if (method === 'SPLIT') return { label: 'Split', tone: 'split' };
  return (
    METHOD_LABELS[method] ?? {
      label: method.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
      tone: 'neutral',
    }
  );
}

export function resolveRecentSalePayment(
  sale: RecentSalePaymentInput,
): RecentSalePaymentSummary {
  // Actual money movement wins: a sale can be stored as NONE/zero-value while
  // its legs carry CARD/BANK-like tenders.
  const legs = (sale.payments ?? []).filter((leg) => amountOf(leg.amount) > 0);
  if (legs.length > 0) {
    const uniqueMethods = [...new Set(legs.map((leg) => leg.method))];
    const labels = uniqueMethods.map(
      (method) => labelForMethod(method) ?? { label: method, tone: 'neutral' as const },
    );

    if (labels.length === 1) return labels[0]!;
    return {
      label: labels.map((entry) => entry.label).join(' + '),
      tone: 'split',
    };
  }

  const methodLabel = labelForMethod(sale.paymentMethod);
  if (methodLabel) return methodLabel;

  const total = amountOf(sale.totalAmount);
  if (total <= 0) {
    const zeroReason = sale.zeroValueReason
      ? ZERO_VALUE_LABELS[sale.zeroValueReason]
      : undefined;
    return zeroReason ?? { label: 'Zero-value', tone: 'zero' };
  }

  // A positive-total sale with no legs and no tender is a data gap, not an
  // unpaid zero-value sale; label it so an operator can investigate.
  return { label: 'Unrecorded', tone: 'neutral' };
}
