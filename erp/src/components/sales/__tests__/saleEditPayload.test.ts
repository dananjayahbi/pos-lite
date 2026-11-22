import { describe, expect, it } from 'vitest';

import { preserveSellingTimestamp, sameSellingDay } from '@/lib/sales/sale-edit';
import { saleEditDatePayload } from '@/components/sales/saleEditPayload';

describe('sale edit keeps the selling timestamp (ARGUS #88)', () => {
  const enteredAt = new Date(2026, 9, 28, 23, 4, 0);

  it('omits saleDate when the operator did not change the day', () => {
    expect(
      saleEditDatePayload({
        saleDate: null,
        createdAt: enteredAt.toISOString(),
        editedDate: '2026-10-28',
      }),
    ).toEqual({});
  });

  it('sends a noon timestamp only for an intentional day change', () => {
    const payload = saleEditDatePayload({
      saleDate: null,
      createdAt: enteredAt.toISOString(),
      editedDate: '2026-10-27',
    });

    expect(payload.saleDate).toBeDefined();
    const sent = new Date(payload.saleDate!);
    expect(sent.getFullYear()).toBe(2026);
    expect(sent.getMonth()).toBe(9);
    expect(sent.getDate()).toBe(27);
    expect(sent.getHours()).toBe(12);
  });

  it('preserves the recorded time-of-day server-side on a same-day edit', () => {
    const noon = new Date(2026, 9, 28, 12, 0);
    expect(sameSellingDay(enteredAt, noon)).toBe(true);
    expect(preserveSellingTimestamp(enteredAt, noon)).toBe(enteredAt);
  });

  it('accepts the new timestamp when the day actually changes', () => {
    const noonNextDay = new Date(2026, 9, 27, 12, 0);
    expect(preserveSellingTimestamp(enteredAt, noonNextDay)).toBe(noonNextDay);
  });
});
