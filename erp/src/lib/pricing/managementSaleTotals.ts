import Decimal from 'decimal.js';

import { allocateCartDiscountShares } from '@/lib/services/saleDiscount.core';
import { getLineTaxRate, type CartTaxRates } from '@/stores/cartStore';
import type { TaxRuleValue } from '@/lib/constants/product-options';

export interface ManagementSaleLine {
  unitPrice: number;
  quantity: number;
  discountPercent: number;
  taxRule?: TaxRuleValue | undefined;
}

export interface ManagementSaleTotals {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  taxRatesApplied: number[];
  deliveryCharge: number;
  total: number;
}

/**
 * Price a management "Record Sale" cart the same way `createSale` will.
 *
 * The sheet used to add no tax at all, so a cashier entered cash against a
 * taxless total while the API persisted a taxed one (ARGUS #74). This mirrors
 * the POS cart: line totals after line discounts, the fixed cart discount
 * apportioned across lines, then each line taxed by its product tax rule.
 */
export function computeManagementSaleTotals(
  lines: ManagementSaleLine[],
  options: {
    cartDiscount: number;
    deliveryCharge?: number;
    taxRates: CartTaxRates;
  },
): ManagementSaleTotals {
  const lineTotals = lines.map((line) => {
    const gross = new Decimal(line.unitPrice).times(line.quantity);
    const net =
      line.discountPercent > 0 ? gross.minus(gross.times(line.discountPercent).div(100)) : gross;
    return net.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  });

  const subtotal = lineTotals
    .reduce((sum, lineTotal) => sum.plus(lineTotal), new Decimal(0))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const cartDiscount = Decimal.min(
    new Decimal(options.cartDiscount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    subtotal,
  );
  const deliveryCharge = new Decimal(options.deliveryCharge ?? 0).toDecimalPlaces(
    2,
    Decimal.ROUND_HALF_UP,
  );

  const discountShares = allocateCartDiscountShares(lineTotals, cartDiscount);
  const ratesApplied = new Set<number>();
  const taxAmount = lines
    .reduce((sum, line, index) => {
      const taxableLine = Decimal.max(lineTotals[index]!.minus(discountShares[index]!), 0);
      const rate = getLineTaxRate(line.taxRule, options.taxRates);
      if (rate.greaterThan(0)) ratesApplied.add(rate.times(100).toNumber());
      return sum.plus(taxableLine.times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP));
    }, new Decimal(0))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const total = subtotal
    .minus(cartDiscount)
    .plus(taxAmount)
    .plus(deliveryCharge)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    subtotal: subtotal.toNumber(),
    discountAmount: cartDiscount.toNumber(),
    taxAmount: taxAmount.toNumber(),
    taxRatesApplied: [...ratesApplied],
    deliveryCharge: deliveryCharge.toNumber(),
    total: total.toNumber(),
  };
}
