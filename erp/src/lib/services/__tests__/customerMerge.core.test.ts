import { describe, expect, it } from 'vitest';

import {
  buildCustomerMergePlan,
  mergeCustomerIdsError,
  type MergeCustomerSnapshot,
} from '@/lib/services/customerMerge.core';

/** ARGUS #320: folding a duplicate into the surviving customer. */
function customer(overrides: Partial<MergeCustomerSnapshot> = {}): MergeCustomerSnapshot {
  return {
    id: 'c1',
    name: 'Malindu',
    phone: '+94771234567',
    phone2: null,
    email: null,
    address: null,
    city: null,
    gender: null,
    birthday: null,
    notes: null,
    tags: [],
    creditBalance: '0',
    totalSpend: '0',
    lastPurchaseAt: null,
    deletedAt: null,
    ...overrides,
  };
}

describe('buildCustomerMergePlan', () => {
  it('sums spend and store credit and keeps the primary details', () => {
    const plan = buildCustomerMergePlan(
      customer({
        email: 'keep@example.com',
        creditBalance: '150.25',
        totalSpend: '1000.00',
        tags: ['VIP'],
        lastPurchaseAt: new Date('2026-11-01T00:00:00Z'),
      }),
      customer({
        id: 'c2',
        name: 'Malndu',
        email: 'dupe@example.com',
        creditBalance: '49.75',
        totalSpend: '250.50',
        tags: ['vip', 'WHOLESALE'],
        lastPurchaseAt: new Date('2026-11-20T00:00:00Z'),
      }),
    );

    expect(plan.fields.creditBalance).toBe(200);
    expect(plan.fields.totalSpend).toBe(1250.5);
    expect(plan.fields.email).toBe('keep@example.com');
    expect(plan.fields.tags).toEqual(['VIP', 'WHOLESALE']);
    expect(plan.fields.lastPurchaseAt?.toISOString()).toBe('2026-11-20T00:00:00.000Z');
    expect(plan.summary.tagsAdded).toBe(1);
  });

  it('fills blanks from the duplicate without overwriting primary values', () => {
    const plan = buildCustomerMergePlan(
      customer({ address: null, city: 'Colombo', notes: '' }),
      customer({ id: 'c2', address: '12 Galle Road', city: 'Galle', notes: 'old note' }),
    );
    expect(plan.fields.address).toBe('12 Galle Road');
    expect(plan.fields.city).toBe('Colombo');
    expect(plan.fields.notes).toBe('old note');
  });

  it('de-duplicates tags case-insensitively and rounds money', () => {
    const plan = buildCustomerMergePlan(
      customer({ tags: ['VIP', 'vip'], creditBalance: '0.10', totalSpend: '0.20' }),
      customer({ id: 'c2', tags: ['Vip', ''], creditBalance: '0.20', totalSpend: '0.10' }),
    );
    expect(plan.fields.tags).toEqual(['VIP']);
    expect(plan.fields.creditBalance).toBe(0.3);
    expect(plan.fields.totalSpend).toBe(0.3);
  });
});

describe('mergeCustomerIdsError', () => {
  it('rejects identical or missing ids', () => {
    expect(mergeCustomerIdsError('a', 'a', true, true)).toMatch(/different/);
    expect(mergeCustomerIdsError('a', 'b', false, true)).toMatch(/keep/);
    expect(mergeCustomerIdsError('a', 'b', true, false)).toMatch(/merge/);
    expect(mergeCustomerIdsError('a', 'b', true, true)).toBeNull();
  });
});
