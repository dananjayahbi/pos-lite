import Decimal from 'decimal.js';
import { allocateCartDiscountShares } from '@/lib/services/saleDiscount.core';

/**
 * Z-report top items (ARGUS #112).
 *
 * The Z-report used each line's `lineTotalAfterDiscount`, which is still the
 * pre-cart-discount price. Cart-level promotions and zero-value bank sales were
 * therefore reported at list price, so the top-items total could exceed the
 * completed-sales revenue (27,588.96 vs 14,026.22 on the open shift).
 *
 * Revenue here is the money collected for the line: its post-line-discount
 * total minus its share of the sale's cart discount, using the same allocation
 * the POS applies before tax (and the dashboard Sales by Product builder uses).
 * Fully discounted/zero-value lines contribute 0. Voided and held (OPEN) sales
 * are excluded — only COMPLETED rows are reportable sales.
 */

type Decimalish = number | string | { toString(): string };

export interface ZReportTopItemLine {
  productNameSnapshot: string;
  variantDescriptionSnapshot: string;
  quantity: number;
  lineTotalAfterDiscount: Decimalish;
}

export interface ZReportTopItemSale {
  status: string;
  discountAmount: Decimalish;
  lines: ZReportTopItemLine[];
}

export interface ZReportTopItem {
  productName: string;
  variantDescription: string;
  totalQtySold: number;
  totalRevenue: number;
}

export function buildZReportTopItems(
  sales: Iterable<ZReportTopItemSale>,
  limit = 10,
): ZReportTopItem[] {
  const productMap = new Map<
    string,
    {
      productName: string;
      variantDescription: string;
      totalQtySold: number;
      totalRevenue: Decimal;
    }
  >();

  for (const sale of sales) {
    if (sale.status !== 'COMPLETED') continue;

    const lineTotals = sale.lines.map(
      (line) => new Decimal(line.lineTotalAfterDiscount.toString()),
    );
    const shares = allocateCartDiscountShares(
      lineTotals,
      new Decimal(sale.discountAmount.toString()),
    );

    sale.lines.forEach((line, index) => {
      const collected = Decimal.max(lineTotals[index]!.minus(shares[index]!), 0);
      const key = `${line.productNameSnapshot}|${line.variantDescriptionSnapshot}`;
      const entry = productMap.get(key) ?? {
        productName: line.productNameSnapshot,
        variantDescription: line.variantDescriptionSnapshot,
        totalQtySold: 0,
        totalRevenue: new Decimal(0),
      };
      entry.totalQtySold += line.quantity;
      entry.totalRevenue = entry.totalRevenue.plus(collected);
      productMap.set(key, entry);
    });
  }

  return Array.from(productMap.values())
    .map((entry) => ({
      ...entry,
      totalRevenue: entry.totalRevenue
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber(),
    }))
    .sort((a, b) => b.totalQtySold - a.totalQtySold)
    .slice(0, limit);
}
