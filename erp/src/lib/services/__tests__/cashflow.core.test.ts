import { describe, expect, it } from 'vitest';

import { reconcileCash, splitCashRefunds } from '@/lib/services/cashflow.core';

/** ARGUS #416: net cash flow must reconcile opening cash to closing cash. */
describe('reconcileCash', () => {  it('closes at opening + debits - credits', () => {
    const result = reconcileCash('1000.00', [
      { source: 'SALE', debit: '500.00', credit: '0' },
      { source: 'EXPENSE', debit: '0', credit: '125.00' },
      { source: 'PURCHASE_ORDER_PAYMENT', debit: '0', credit: '200.00' },
    ]);

    expect(result.netMovement).toBe('175.00');
    expect(result.closingCash).toBe(1175);
  });

  it('builds a per-source bridge that sums to the net movement', () => {
    const result = reconcileCash(0, [
      { source: 'SALE', debit: 138834.03, credit: 0 },
      { source: 'SALE_REFUND', debit: 0, credit: 7539.6 },
      { source: 'EXPENSE', debit: 0, credit: 5125 },
      { source: 'PURCHASE_ORDER_PAYMENT', debit: 0, credit: 10048.41 },
      { source: 'CASH_TRANSFER', debit: 0, credit: 165 },
    ]);

    const sum = result.bridge.reduce((acc, line) => acc + parseFloat(line.net), 0);
    expect(Math.round(sum * 100) / 100).toBe(parseFloat(result.netMovement));
    expect(result.closingCash).toBe(115956.02);
  });

  it('sorts bridge lines by absolute value', () => {
    const result = reconcileCash(0, [
      { source: 'SMALL', debit: 1, credit: 0 },
      { source: 'BIG', debit: 100, credit: 0 },
    ]);

    expect(result.bridge.map((line) => line.source)).toEqual(['BIG', 'SMALL']);
  });

  it('handles an empty window without changing cash', () => {
    const result = reconcileCash('500.00', []);
    expect(result.netMovement).toBe('0.00');
    expect(result.closingCash).toBe(500);
    expect(result.bridge).toEqual([]);
  });
});

/** ARGUS #417: only cash/card refunds reduce cash. */
describe('splitCashRefunds', () => {
  it('separates credit/exchange refunds from cash-impacting ones', () => {
    const result = splitCashRefunds([
      { method: 'CASH', total: '2584.00' },
      { method: 'CARD_REVERSAL', total: '2976.80' },
      { method: 'STORE_CREDIT', total: '738.40' },
      { method: 'EXCHANGE', total: '1240.40' },
    ]);

    expect(result.total).toBe(7539.6);
    expect(result.cash).toBe(5560.8);
    expect(result.nonCash).toBe(1978.8);
    expect(result.byMethod).toHaveLength(4);
  });

  it('handles an all-cash refund window', () => {
    const result = splitCashRefunds([{ method: 'CASH', total: 100 }]);
    expect(result.cash).toBe(100);
    expect(result.nonCash).toBe(0);
  });
});
