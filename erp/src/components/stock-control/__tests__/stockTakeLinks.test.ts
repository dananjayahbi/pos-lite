import { describe, expect, it } from 'vitest';

import { stockTakeAction } from '@/components/stock-control/stockTakeLinks';

/**
 * ARGUS #182 — PENDING_APPROVAL rows must open the review/approval screen.
 */
describe('stockTakeAction', () => {
  const id = 'stk_123';

  it('sends in-progress sessions to the counting page', () => {
    expect(stockTakeAction(id, 'IN_PROGRESS')).toEqual({
      href: `/stock-control/stock-takes/${id}`,
      label: 'Continue Counting',
    });
  });

  it('sends pending-approval sessions to the review page', () => {
    expect(stockTakeAction(id, 'PENDING_APPROVAL')).toEqual({
      href: `/stock-control/stock-takes/${id}/review`,
      label: 'Review',
    });
  });

  it.each(['APPROVED', 'REJECTED', 'CANCELLED', null])(
    'keeps completed/unknown status %s on the detail page',
    (status) => {
      expect(stockTakeAction(id, status)).toEqual({
        href: `/stock-control/stock-takes/${id}`,
        label: 'View Details',
      });
    },
  );
});
