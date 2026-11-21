import { describe, expect, it } from 'vitest';

import {
  classifyLedgerSource,
  matchesLedgerSourceFilter,
} from '@/lib/services/paymentAccountLedger.core';

const ids = {
  returnIds: new Set(['return-1']),
  saleIds: new Set(['sale-1']),
};

/** ARGUS #430: void reversals are not return refunds. */
describe('ledger source classification', () => {
  it('labels a SALE_REFUND tied to a sale as SALE_VOID', () => {
    expect(classifyLedgerSource('SALE_REFUND', 'sale-1', ids)).toBe('SALE_VOID');
  });

  it('keeps a return refund as SALE_REFUND', () => {
    expect(classifyLedgerSource('SALE_REFUND', 'return-1', ids)).toBe('SALE_REFUND');
    expect(classifyLedgerSource('SALE_REFUND', 'return-cancel:return-1', ids)).toBe(
      'SALE_REFUND',
    );
  });

  it('passes other sources through unchanged', () => {
    expect(classifyLedgerSource('SALE', 'sale-1', ids)).toBe('SALE');
    expect(classifyLedgerSource('EXPENSE', null, ids)).toBe('EXPENSE');
  });
});

describe('ledger source filters', () => {
  it('SALE_VOID returns only void reversals', () => {
    expect(matchesLedgerSourceFilter('SALE_REFUND', 'sale-1', 'SALE_VOID', ids)).toBe(
      true,
    );
    expect(
      matchesLedgerSourceFilter('SALE_REFUND', 'return-1', 'SALE_VOID', ids),
    ).toBe(false);
  });

  it('SALE_REFUND returns returns and excludes voids', () => {
    expect(
      matchesLedgerSourceFilter('SALE_REFUND', 'return-1', 'SALE_REFUND', ids),
    ).toBe(true);
    expect(
      matchesLedgerSourceFilter('SALE_REFUND', 'sale-1', 'SALE_REFUND', ids),
    ).toBe(false);
  });

  it('keeps exact-source filters working', () => {
    expect(matchesLedgerSourceFilter('SALE', 'sale-1', 'SALE', ids)).toBe(true);
    expect(matchesLedgerSourceFilter('EXPENSE', null, 'SALE', ids)).toBe(false);
  });
});
