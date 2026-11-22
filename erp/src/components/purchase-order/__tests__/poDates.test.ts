import { describe, expect, it } from 'vitest';

import { poDeliveryDateError, poDueDay, poDueState } from '@/components/purchase-order/poDates';

describe('purchase-order delivery dates (ARGUS #233)', () => {
  it('rejects a delivery before the order day', () => {
    expect(poDeliveryDateError('2026-10-29', '2026-10-04')).toBe(
      'Expected delivery cannot be before the order date',
    );
  });

  it('accepts the same day or later and ignores an empty delivery', () => {
    expect(poDeliveryDateError('2026-10-29', '2026-10-29')).toBeNull();
    expect(poDeliveryDateError('2026-10-29', '2026-11-02')).toBeNull();
    expect(poDeliveryDateError('2026-10-29', '')).toBeNull();
  });

  it('derives the due day from the payment term', () => {
    expect(poDueDay('2026-11-09', 30)).toBe('2026-12-09');
    expect(poDueDay('2026-11-09', 10)).toBe('2026-11-19');
    expect(poDueDay('2026-11-09', null)).toBe('2026-11-09');
  });

  it('reports overdue, due, paid and not-applicable states', () => {
    expect(
      poDueState({ dueDay: '2026-12-09', status: 'SENT', outstanding: 100, today: '2026-12-10' }),
    ).toBe('overdue');
    expect(
      poDueState({ dueDay: '2026-12-09', status: 'SENT', outstanding: 100, today: '2026-12-09' }),
    ).toBe('due');
    expect(
      poDueState({ dueDay: '2026-12-09', status: 'RECEIVED', outstanding: 0, today: '2026-12-10' }),
    ).toBe('paid');
    expect(poDueState({ dueDay: '2026-12-09', status: 'DRAFT', outstanding: 100 })).toBe(
      'not_applicable',
    );
    expect(poDueState({ dueDay: '2026-12-09', status: 'CANCELLED', outstanding: 100 })).toBe(
      'not_applicable',
    );
  });
});
