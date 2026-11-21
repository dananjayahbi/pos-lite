import { describe, expect, it } from 'vitest';

import {
  buildIncomeStatementBridge,
  classifySaleRefundEntries,
  reconcileCash,
  reconcilePaymentMethods,
  splitCashRefunds,
  summarizeAccountLedger,
} from '@/lib/services/cashflow.core';

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

/** ARGUS #419: the method split must reconcile to Gross Sales. */
describe('reconcilePaymentMethods', () => {
  it('reports completed sales with no payment rows as unallocated', () => {
    const result = reconcilePaymentMethods('138834.03', [
      { method: 'CASH', total: '118834.03' },
      { method: 'CARD', total: '10000.00' },
    ]);

    expect(result.allocated).toBe(128834.03);
    expect(result.unallocated).toBe(10000);
    expect(result.status).toBe('UNALLOCATED');
  });

  it('is balanced when every rupee has a method row', () => {
    const result = reconcilePaymentMethods(100, [{ method: 'CASH', total: 100 }]);
    expect(result.unallocated).toBe(0);
    expect(result.status).toBe('BALANCED');
  });

  it('flags payment rows that exceed Gross Sales', () => {
    const result = reconcilePaymentMethods(100, [{ method: 'CASH', total: 125 }]);
    expect(result.unallocated).toBe(-25);
    expect(result.status).toBe('OVERALLOCATED');
  });
});

/** ARGUS #418: ledger populations must be separated and bridged to the P&L. */
describe('classifySaleRefundEntries', () => {
  it('separates return refunds, void reversals and return cancellations', () => {
    const split = classifySaleRefundEntries(
      [
        { sourceId: 'return-1', debit: 0, credit: 2584 },
        { sourceId: 'sale-1', debit: 0, credit: 128766.7 },
        { sourceId: 'return-cancel:return-2', debit: 100, credit: 0 },
        { sourceId: 'unknown-1', debit: 0, credit: 5 },
      ],
      { returnIds: ['return-1'], saleIds: ['sale-1'] },
    );

    expect(split.returnCredit).toBe(2584);
    expect(split.voidCredit).toBe(128766.7);
    expect(split.returnDebit).toBe(100);
    expect(split.unmatchedCredit).toBe(5);
  });
});

describe('summarizeAccountLedger', () => {
  it('keeps opening balances and transfers out of operating movement', () => {
    const summary = summarizeAccountLedger(
      [
        { source: 'SALE', debit: '151394.52', credit: 0 },
        { source: 'SALE_REFUND', debit: 0, credit: '136306.30' },
        { source: 'OPENING_BALANCE', debit: '160125.00', credit: 0 },
        { source: 'FUND_TRANSFER', debit: 500, credit: 500 },
        { source: 'EXPENSE', debit: 0, credit: '5125.00' },
        { source: 'PURCHASE_ORDER_PAYMENT', debit: 0, credit: '10048.41' },
      ],
      {
        returnDebit: 0,
        returnCredit: 7539.6,
        voidDebit: 0,
        voidCredit: 128766.7,
        unmatchedDebit: 0,
        unmatchedCredit: 0,
      },
    );

    expect(summary.operatingDebit).toBe(151394.52);
    expect(summary.operatingCredit).toBe(151479.71);
    expect(summary.operatingMovement).toBe(-85.19);
    expect(summary.openingBalance).toBe(160125);
    expect(summary.transfersNet).toBe(0);
    expect(summary.returnRefundCredits).toBe(7539.6);
    expect(summary.voidReversalCredits).toBe(128766.7);
    expect(summary.periodMovement).toBe(160039.81);
    expect(summary.breakdown.map((line) => line.category)).toEqual(
      expect.arrayContaining([
        'SALE',
        'SALE_REFUND_RETURN',
        'SALE_REFUND_VOID',
        'OPENING_BALANCE',
        'FUND_TRANSFER',
      ]),
    );
  });

  it('leaves SALE_REFUND unclassified when the split is unknown', () => {
    const summary = summarizeAccountLedger([
      { source: 'SALE_REFUND', debit: 0, credit: 100 },
    ]);

    expect(summary.unclassifiedNet).toBe(-100);
    expect(summary.returnRefundCredits).toBe(0);
    expect(summary.voidReversalCredits).toBe(0);
  });
});

describe('buildIncomeStatementBridge', () => {
  it('surfaces the ledger-vs-P&L sales and refund variances as exceptions', () => {
    const bridge = buildIncomeStatementBridge({
      ledgerSales: '151394.52',
      statementGrossSales: '138834.03',
      ledgerReturnRefundCredits: '7539.60',
      ledgerReturnCancellationDebits: 0,
      ledgerVoidReversalCredits: '128766.70',
      statementReturns: '7539.60',
      statementCashRefunds: '5560.80',
      openingBalancesExcluded: '160125.00',
    });

    expect(bridge.sales.variance).toBe(12560.49);
    expect(bridge.refunds.ledgerReturnNet).toBe(7539.6);
    expect(bridge.refunds.nonCashStatementRefunds).toBe(1978.8);
    expect(bridge.refunds.variance).toBe(1978.8);
    expect(bridge.openingBalancesExcluded).toBe(160125);
    expect(bridge.exceptions.map((line) => line.code)).toEqual([
      'SALES_VARIANCE',
      'RETURN_VARIANCE',
    ]);
  });

  it('reports no exceptions when both populations agree', () => {
    const bridge = buildIncomeStatementBridge({
      ledgerSales: 100,
      statementGrossSales: 100,
      ledgerReturnRefundCredits: 10,
      ledgerReturnCancellationDebits: 0,
      ledgerVoidReversalCredits: 0,
      statementReturns: 10,
      statementCashRefunds: 10,
      openingBalancesExcluded: 0,
    });

    expect(bridge.exceptions).toEqual([]);
  });
});
