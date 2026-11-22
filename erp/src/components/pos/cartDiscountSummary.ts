import Decimal from 'decimal.js';

import { formatRupee } from '@/lib/format';

/**
 * ARGUS #67 — collapsed POS discount summary.
 *
 * The header must reflect every active discount: line discounts, the manual
 * cart discount and automatic/promo-code promotions. Line discounts are
 * already baked into the cart subtotal, so the total savings is the sum of all
 * three, capped at the gross line value.
 */
type Decimalish = Decimal | number | string;

export interface CartDiscountSummaryItem {
  unitPrice: number | string;
  quantity: number;
  discountPercent: number;
}

export interface CartDiscountSummary {
  hasAny: boolean;
  lineDiscount: string;
  manualDiscount: string;
  promotionDiscount: string;
  totalDiscount: string;
  /** e.g. "line 5% + cart 10% + promo". */
  parts: string[];
  /** e.g. "Discounts: Rs 14.25 (line 5% + promo)". */
  label: string;
  /** Full amounts for the header tooltip. */
  tooltip: string;
}

function money(value: Decimal): string {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

export function summarizeCartDiscounts(input: {
  items: ReadonlyArray<CartDiscountSummaryItem>;
  subtotal: Decimalish;
  manualDiscount: Decimalish;
  promotionDiscount: Decimalish;
  cartDiscountPercent?: number | undefined;
  promoCode?: string | null | undefined;
}): CartDiscountSummary {
  const lineDiscount = input.items.reduce((sum, item) => {
    const gross = new Decimal(item.unitPrice).times(item.quantity);
    const percent = Decimal.min(Decimal.max(item.discountPercent, 0), 100);
    return sum.plus(gross.times(percent).div(100));
  }, new Decimal(0));
  const manualDiscount = Decimal.max(new Decimal(input.manualDiscount.toString()), 0);
  const promotionDiscount = Decimal.max(
    new Decimal(input.promotionDiscount.toString()),
    0,
  );
  const gross = Decimal.max(new Decimal(input.subtotal.toString()), 0).plus(lineDiscount);
  const total = Decimal.min(
    lineDiscount.plus(manualDiscount).plus(promotionDiscount),
    gross,
  ).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const parts: string[] = [];
  const linePercents = [...new Set(
    input.items
      .filter((item) => item.discountPercent > 0)
      .map((item) => item.discountPercent),
  )].sort((a, b) => a - b);
  if (lineDiscount.greaterThan(0)) {
    parts.push(
      linePercents.length === 1 ? `line ${linePercents[0]}%` : 'line discounts',
    );
  }
  if (manualDiscount.greaterThan(0)) {
    const cartPercent = input.cartDiscountPercent ?? 0;
    parts.push(cartPercent > 0 ? `cart ${cartPercent}%` : 'cart discount');
  }
  if (promotionDiscount.greaterThan(0)) {
    parts.push(input.promoCode ? `promo ${input.promoCode}` : 'promo');
  }

  const hasAny = total.greaterThan(0);
  const totalLabel = money(total);
  return {
    hasAny,
    lineDiscount: money(lineDiscount),
    manualDiscount: money(manualDiscount),
    promotionDiscount: money(promotionDiscount),
    totalDiscount: totalLabel,
    parts,
    label: hasAny
      ? `Discounts: ${formatRupee(totalLabel)} (${parts.join(' + ')})`
      : 'No discount or promo',
    tooltip: hasAny
      ? [
          `Line discounts: ${formatRupee(money(lineDiscount))}`,
          `Cart discount: ${formatRupee(money(manualDiscount))}`,
          `Promotions: ${formatRupee(money(promotionDiscount))}`,
          `Total discount: ${formatRupee(totalLabel)}`,
        ].join(' · ')
      : 'No discount or promo',
  };
}
