import { describe, expect, it } from 'vitest';

import {
  buildZReportTopItems,
  type ZReportTopItemSale,
} from '@/lib/shifts/z-report-top-items';

function sale(overrides: Partial<ZReportTopItemSale> = {}): ZReportTopItemSale {
  return {
    status: 'COMPLETED',
    discountAmount: 0,
    lines: [],
    ...overrides,
  };
}

/** ARGUS #112 — top items must report collected money, not list price. */
describe('buildZReportTopItems', () => {
  it('allocates the sale cart discount across lines before reporting revenue', () => {
    const items = buildZReportTopItems([
      sale({
        discountAmount: 500,
        lines: [
          {
            productNameSnapshot: 'Bhringraj',
            variantDescriptionSnapshot: '100g',
            quantity: 2,
            lineTotalAfterDiscount: 1000,
          },
          {
            productNameSnapshot: 'Ashwagandha',
            variantDescriptionSnapshot: '100g',
            quantity: 1,
            lineTotalAfterDiscount: 1000,
          },
        ],
      }),
    ]);

    expect(items).toEqual([
      {
        productName: 'Bhringraj',
        variantDescription: '100g',
        totalQtySold: 2,
        totalRevenue: 750,
      },
      {
        productName: 'Ashwagandha',
        variantDescription: '100g',
        totalQtySold: 1,
        totalRevenue: 750,
      },
    ]);
    expect(items.reduce((sum, item) => sum + item.totalRevenue, 0)).toBe(1500);
  });

  it('reports zero revenue for zero-value and fully discounted lines', () => {
    const items = buildZReportTopItems([
      sale({
        discountAmount: 500,
        lines: [
          {
            productNameSnapshot: 'Replacement Gift',
            variantDescriptionSnapshot: '-',
            quantity: 1,
            lineTotalAfterDiscount: 0,
          },
          {
            productNameSnapshot: 'Fully Discounted Oil',
            variantDescriptionSnapshot: '50ml',
            quantity: 1,
            lineTotalAfterDiscount: 500,
          },
        ],
      }),
    ]);

    expect(items).toEqual(
      expect.arrayContaining([
        {
          productName: 'Replacement Gift',
          variantDescription: '-',
          totalQtySold: 1,
          totalRevenue: 0,
        },
        {
          productName: 'Fully Discounted Oil',
          variantDescription: '50ml',
          totalQtySold: 1,
          totalRevenue: 0,
        },
      ]),
    );
  });

  it('excludes voided and held (OPEN) sales', () => {
    const line = {
      productNameSnapshot: 'Bhringraj',
      variantDescriptionSnapshot: '100g',
      quantity: 5,
      lineTotalAfterDiscount: 1000,
    };

    const items = buildZReportTopItems([
      sale({ status: 'VOIDED', lines: [line] }),
      sale({ status: 'OPEN', lines: [line] }),
      sale({
        status: 'COMPLETED',
        lines: [{ ...line, quantity: 1 }],
      }),
    ]);

    expect(items).toEqual([
      {
        productName: 'Bhringraj',
        variantDescription: '100g',
        totalQtySold: 1,
        totalRevenue: 1000,
      },
    ]);
  });

  it('aggregates by product and variant across completed sales', () => {
    const items = buildZReportTopItems([
      sale({
        discountAmount: 0,
        lines: [
          {
            productNameSnapshot: 'Bhringraj',
            variantDescriptionSnapshot: '100g',
            quantity: 2,
            lineTotalAfterDiscount: 300,
          },
        ],
      }),
      sale({
        discountAmount: 100,
        lines: [
          {
            productNameSnapshot: 'Bhringraj',
            variantDescriptionSnapshot: '100g',
            quantity: 1,
            lineTotalAfterDiscount: 200,
          },
          {
            productNameSnapshot: 'Bhringraj',
            variantDescriptionSnapshot: '250g',
            quantity: 1,
            lineTotalAfterDiscount: 200,
          },
        ],
      }),
    ]);

    expect(items).toEqual([
      {
        productName: 'Bhringraj',
        variantDescription: '100g',
        totalQtySold: 3,
        totalRevenue: 450,
      },
      {
        productName: 'Bhringraj',
        variantDescription: '250g',
        totalQtySold: 1,
        totalRevenue: 150,
      },
    ]);
  });

  it('returns nothing for an empty shift and respects the limit', () => {
    expect(buildZReportTopItems([])).toEqual([]);

    const items = buildZReportTopItems(
      [
        sale({
          lines: [
            {
              productNameSnapshot: 'A',
              variantDescriptionSnapshot: '-',
              quantity: 3,
              lineTotalAfterDiscount: 30,
            },
            {
              productNameSnapshot: 'B',
              variantDescriptionSnapshot: '-',
              quantity: 2,
              lineTotalAfterDiscount: 20,
            },
            {
              productNameSnapshot: 'C',
              variantDescriptionSnapshot: '-',
              quantity: 1,
              lineTotalAfterDiscount: 10,
            },
          ],
        }),
      ],
      2,
    );

    expect(items.map((item) => item.productName)).toEqual(['A', 'B']);
  });
});
