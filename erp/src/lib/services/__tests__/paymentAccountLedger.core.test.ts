import { describe, expect, it } from 'vitest';

import {
  classifyLedgerSource,
  ledgerTotalPages,
  matchesLedgerSourceFilter,
  nextAccountBalance,
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

/** ARGUS #434: the ledger arithmetic and paging rules now have unit coverage. */
describe('ledger balance arithmetic', () => {
  it('adds debits and subtracts credits', () => {
    expect(nextAccountBalance('1000.00', '250.50', 0).toString()).toBe('1250.5');
    expect(nextAccountBalance('1000.00', 0, '250.50').toString()).toBe('749.5');
    expect(nextAccountBalance(0, 0, '50.00').toString()).toBe('-50');
  });

  it('keeps cent-level precision instead of binary-float drift', () => {
    expect(nextAccountBalance('0.10', '0.20', 0).toFixed(2)).toBe('0.30');
    expect(nextAccountBalance('10.00', 0, '0.01').toFixed(2)).toBe('9.99');
  });
});

describe('ledger pagination', () => {
  it('rounds a partial last page up', () => {
    expect(ledgerTotalPages(141, 25)).toBe(6);
    expect(ledgerTotalPages(150, 25)).toBe(6);
    expect(ledgerTotalPages(1, 25)).toBe(1);
  });

  it('reports no pages for an empty or invalid result', () => {
    expect(ledgerTotalPages(0, 25)).toBe(0);
    expect(ledgerTotalPages(-1, 25)).toBe(0);
    expect(ledgerTotalPages(10, 0)).toBe(0);
  });
});
