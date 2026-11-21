import Decimal from 'decimal.js';

type Decimalish = number | string | { toString(): string };

export interface CashBridgeLineInput {
  source: string;
  debit: Decimalish;
  credit: Decimalish;
}

export interface CashReconciliation {
  /** Net movement as a 2dp string, ready for the API envelope. */
  netMovement: string;
  closingCash: number;
  bridge: Array<{ source: string; debit: string; credit: string; net: string }>;
}

/**
 * Ledger-truth cash reconciliation (ARGUS #416).
 *
 * Net cash flow is opening cash + every debit minus every credit in the window,
 * with one bridge line per ledger source. This is what reconciles to the payment
 * account balances; sales minus expenses is only a period operating summary.
 */
export function reconcileCash(openingCash: Decimalish, lines: CashBridgeLineInput[]): CashReconciliation {
  const opening = new Decimal(openingCash.toString());
  let net = new Decimal(0);

  const bridge = lines.map((line) => {
    const debit = new Decimal(line.debit.toString());
    const credit = new Decimal(line.credit.toString());
    const lineNet = debit.minus(credit);
    net = net.plus(lineNet);
    return {
      source: line.source,
      debit: debit.toFixed(2),
      credit: credit.toFixed(2),
      net: lineNet.toFixed(2),
    };
  });

  bridge.sort((a, b) => Math.abs(parseFloat(b.net)) - Math.abs(parseFloat(a.net)));

  return {
    netMovement: net.toFixed(2),
    closingCash: opening.plus(net).toDecimalPlaces(2).toNumber(),
    bridge,
  };
}

export interface RefundMethodTotal {
  method: string;
  total: Decimalish;
}

// ── Ledger vs income-statement reconciliation (ARGUS #418) ──────────────────

/**
 * Ledger sources that move money between the tenant's own accounts. They change
 * an account balance but are not trading income or expense, so the report shows
 * them separately and never folds them into Money In / Money Out.
 */
export const TRANSFER_ENTRY_SOURCES = new Set([
  'FUND_TRANSFER',
  'DEPOSIT',
  'WITHDRAWAL',
  'CLOSING_TRANSFER',
]);

export type LedgerTreatment =
  | 'sale'
  | 'return_refund'
  | 'return_cancellation'
  | 'void_reversal'
  | 'opening'
  | 'transfer'
  | 'expense'
  | 'purchase_order'
  | 'adjustment'
  | 'unclassified';

export interface LedgerSourceRow {
  source: string;
  debit: Decimalish;
  credit: Decimalish;
}

export interface SaleRefundLedgerEntry {
  sourceId: string | null;
  debit: Decimalish;
  credit: Decimalish;
}

export interface SaleRefundSplit {
  returnDebit: number;
  returnCredit: number;
  voidDebit: number;
  voidCredit: number;
  unmatchedDebit: number;
  unmatchedCredit: number;
}

/**
 * A SALE_REFUND ledger row is used for three different populations:
 *
 *   - a return refund (sourceId = return id)
 *   - a void / full-sale reversal (sourceId = sale id)
 *   - a cancelled-return reversal (sourceId = `return-cancel:<return id>`)
 *
 * Grouping by source alone therefore mixes them together. Splitting by the
 * originating document is what lets the report reconcile ledger refunds to the
 * income statement's returns instead of showing one unexplained 136k credit.
 */
export function classifySaleRefundEntries(
  entries: SaleRefundLedgerEntry[],
  ids: { returnIds: Iterable<string>; saleIds: Iterable<string> },
): SaleRefundSplit {
  const returnIds = ids.returnIds instanceof Set ? ids.returnIds : new Set(ids.returnIds);
  const saleIds = ids.saleIds instanceof Set ? ids.saleIds : new Set(ids.saleIds);

  const totals = {
    returnDebit: new Decimal(0),
    returnCredit: new Decimal(0),
    voidDebit: new Decimal(0),
    voidCredit: new Decimal(0),
    unmatchedDebit: new Decimal(0),
    unmatchedCredit: new Decimal(0),
  };

  for (const entry of entries) {
    const debit = new Decimal(entry.debit.toString());
    const credit = new Decimal(entry.credit.toString());
    const sourceId = entry.sourceId ?? '';

    if (returnIds.has(sourceId) || sourceId.startsWith('return-cancel:')) {
      totals.returnDebit = totals.returnDebit.plus(debit);
      totals.returnCredit = totals.returnCredit.plus(credit);
    } else if (saleIds.has(sourceId)) {
      totals.voidDebit = totals.voidDebit.plus(debit);
      totals.voidCredit = totals.voidCredit.plus(credit);
    } else {
      totals.unmatchedDebit = totals.unmatchedDebit.plus(debit);
      totals.unmatchedCredit = totals.unmatchedCredit.plus(credit);
    }
  }

  return {
    returnDebit: totals.returnDebit.toDecimalPlaces(2).toNumber(),
    returnCredit: totals.returnCredit.toDecimalPlaces(2).toNumber(),
    voidDebit: totals.voidDebit.toDecimalPlaces(2).toNumber(),
    voidCredit: totals.voidCredit.toDecimalPlaces(2).toNumber(),
    unmatchedDebit: totals.unmatchedDebit.toDecimalPlaces(2).toNumber(),
    unmatchedCredit: totals.unmatchedCredit.toDecimalPlaces(2).toNumber(),
  };
}

export interface LedgerBreakdownLine {
  category: string;
  debit: number;
  credit: number;
  net: number;
  treatment: LedgerTreatment;
}

export interface AccountLedgerSummary {
  breakdown: LedgerBreakdownLine[];
  periodDebit: number;
  periodCredit: number;
  /** Every period movement, including opening balances and transfers. */
  periodMovement: number;
  /** Trading movement only; opening balances and internal transfers excluded. */
  operatingDebit: number;
  operatingCredit: number;
  operatingMovement: number;
  openingBalance: number;
  transfersNet: number;
  salesNet: number;
  returnRefundCredits: number;
  returnCancellationDebits: number;
  voidReversalCredits: number;
  voidReversalDebits: number;
  expensesNet: number;
  purchaseOrderPaymentsNet: number;
  adjustmentsNet: number;
  unclassifiedNet: number;
}

interface BreakdownAccumulator {
  category: string;
  treatment: LedgerTreatment;
  debit: Decimal;
  credit: Decimal;
}

/**
 * Classify a window's ledger rows into populations the income statement can be
 * reconciled against (sales, return refunds, void reversals, opening balances,
 * transfers, expenses, purchase-order payments and adjustments).
 *
 * Monetary decisions stay here rather than in the page so the UI can only
 * display what the server computed.
 */
export function summarizeAccountLedger(
  sources: LedgerSourceRow[],
  saleRefundSplit?: SaleRefundSplit,
): AccountLedgerSummary {
  const rows = new Map<string, BreakdownAccumulator>();

  const add = (
    category: string,
    treatment: LedgerTreatment,
    debit: Decimalish,
    credit: Decimalish,
  ) => {
    const existing = rows.get(category);
    const target =
      existing ??
      {
        category,
        treatment,
        debit: new Decimal(0),
        credit: new Decimal(0),
      };
    target.debit = target.debit.plus(debit.toString());
    target.credit = target.credit.plus(credit.toString());
    rows.set(category, target);
  };

  for (const row of sources) {
    const debit = new Decimal(row.debit.toString());
    const credit = new Decimal(row.credit.toString());
    const source = row.source;

    if (source === 'SALE_REFUND') {
      if (saleRefundSplit) {
        add('SALE_REFUND_RETURN', 'return_refund', 0, saleRefundSplit.returnCredit);
        if (saleRefundSplit.returnDebit !== 0) {
          add(
            'SALE_REFUND_CANCELLATION',
            'return_cancellation',
            saleRefundSplit.returnDebit,
            0,
          );
        }
        if (saleRefundSplit.voidCredit !== 0) {
          add('SALE_REFUND_VOID', 'void_reversal', 0, saleRefundSplit.voidCredit);
        }
        if (saleRefundSplit.voidDebit !== 0) {
          add('SALE_REFUND_VOID_DEBIT', 'void_reversal', saleRefundSplit.voidDebit, 0);
        }
        if (saleRefundSplit.unmatchedCredit !== 0 || saleRefundSplit.unmatchedDebit !== 0) {
          add(
            'SALE_REFUND_UNMATCHED',
            'unclassified',
            saleRefundSplit.unmatchedDebit,
            saleRefundSplit.unmatchedCredit,
          );
        }
      } else {
        add('SALE_REFUND', 'unclassified', debit, credit);
      }
      continue;
    }

    if (source === 'OPENING_BALANCE') {
      add(source, 'opening', debit, credit);
    } else if (source === 'SALE') {
      add(source, 'sale', debit, credit);
    } else if (source === 'EXPENSE') {
      add(source, 'expense', debit, credit);
    } else if (source === 'PURCHASE_ORDER_PAYMENT') {
      add(source, 'purchase_order', debit, credit);
    } else if (source === 'ADJUSTMENT') {
      add(source, 'adjustment', debit, credit);
    } else if (TRANSFER_ENTRY_SOURCES.has(source)) {
      add(source, 'transfer', debit, credit);
    } else {
      add(source, 'unclassified', debit, credit);
    }
  }

  const breakdown = Array.from(rows.values())
    .map((row) => ({
      category: row.category,
      debit: row.debit.toDecimalPlaces(2).toNumber(),
      credit: row.credit.toDecimalPlaces(2).toNumber(),
      net: row.debit.minus(row.credit).toDecimalPlaces(2).toNumber(),
      treatment: row.treatment,
    }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

  const sumBy = (
    predicate: (line: LedgerBreakdownLine) => boolean,
    field: 'debit' | 'credit' | 'net',
  ) =>
    breakdown
      .filter(predicate)
      .reduce((total, line) => total.plus(line[field]), new Decimal(0))
      .toDecimalPlaces(2)
      .toNumber();

  const isOperating = (line: LedgerBreakdownLine) =>
    line.treatment !== 'opening' && line.treatment !== 'transfer';

  const periodDebit = sumBy(() => true, 'debit');
  const periodCredit = sumBy(() => true, 'credit');
  const operatingDebit = sumBy(isOperating, 'debit');
  const operatingCredit = sumBy(isOperating, 'credit');

  return {
    breakdown,
    periodDebit,
    periodCredit,
    periodMovement: new Decimal(periodDebit).minus(periodCredit).toDecimalPlaces(2).toNumber(),
    operatingDebit,
    operatingCredit,
    operatingMovement: new Decimal(operatingDebit)
      .minus(operatingCredit)
      .toDecimalPlaces(2)
      .toNumber(),
    openingBalance: sumBy((line) => line.treatment === 'opening', 'net'),
    transfersNet: sumBy((line) => line.treatment === 'transfer', 'net'),
    salesNet: sumBy((line) => line.treatment === 'sale', 'net'),
    returnRefundCredits: sumBy((line) => line.treatment === 'return_refund', 'credit'),
    returnCancellationDebits: sumBy(
      (line) => line.treatment === 'return_cancellation',
      'debit',
    ),
    voidReversalCredits: sumBy((line) => line.treatment === 'void_reversal', 'credit'),
    voidReversalDebits: sumBy((line) => line.treatment === 'void_reversal', 'debit'),
    expensesNet: sumBy((line) => line.treatment === 'expense', 'net'),
    purchaseOrderPaymentsNet: sumBy((line) => line.treatment === 'purchase_order', 'net'),
    adjustmentsNet: sumBy((line) => line.treatment === 'adjustment', 'net'),
    unclassifiedNet: sumBy((line) => line.treatment === 'unclassified', 'net'),
  };
}

export interface IncomeStatementBridgeInput {
  ledgerSales: Decimalish;
  statementGrossSales: Decimalish;
  ledgerReturnRefundCredits: Decimalish;
  ledgerReturnCancellationDebits: Decimalish;
  ledgerVoidReversalCredits: Decimalish;
  statementReturns: Decimalish;
  statementCashRefunds: Decimalish;
  openingBalancesExcluded: Decimalish;
}

export interface IncomeStatementBridge {
  sales: { ledger: number; statement: number; variance: number };
  refunds: {
    returnCredits: number;
    returnCancellations: number;
    voidReversals: number;
    statementReturns: number;
    statementCashRefunds: number;
    nonCashStatementRefunds: number;
    ledgerReturnNet: number;
    variance: number;
  };
  openingBalancesExcluded: number;
  exceptions: Array<{ code: 'SALES_VARIANCE' | 'RETURN_VARIANCE'; amount: number }>;
}

/**
 * Bridge the payment-account ledger to the period income statement. The two
 * describe different populations (ledger includes void reversals and opening
 * balances; the income statement includes non-cash refunds), so the report
 * needs explicit variances rather than pretending the totals are the same.
 */
export function buildIncomeStatementBridge(
  input: IncomeStatementBridgeInput,
): IncomeStatementBridge {
  const salesLedger = new Decimal(input.ledgerSales.toString());
  const salesStatement = new Decimal(input.statementGrossSales.toString());
  const salesVariance = salesLedger.minus(salesStatement);

  const returnCredits = new Decimal(input.ledgerReturnRefundCredits.toString());
  const returnCancellations = new Decimal(input.ledgerReturnCancellationDebits.toString());
  const voidReversals = new Decimal(input.ledgerVoidReversalCredits.toString());
  const statementReturns = new Decimal(input.statementReturns.toString());
  const statementCashRefunds = new Decimal(input.statementCashRefunds.toString());
  const ledgerReturnNet = returnCredits.minus(returnCancellations);
  const returnVariance = ledgerReturnNet.minus(statementCashRefunds);

  const exceptions: IncomeStatementBridge['exceptions'] = [];
  if (!salesVariance.toDecimalPlaces(2).equals(0)) {
    exceptions.push({
      code: 'SALES_VARIANCE',
      amount: salesVariance.toDecimalPlaces(2).toNumber(),
    });
  }
  if (!returnVariance.toDecimalPlaces(2).equals(0)) {
    exceptions.push({
      code: 'RETURN_VARIANCE',
      amount: returnVariance.toDecimalPlaces(2).toNumber(),
    });
  }

  return {
    sales: {
      ledger: salesLedger.toDecimalPlaces(2).toNumber(),
      statement: salesStatement.toDecimalPlaces(2).toNumber(),
      variance: salesVariance.toDecimalPlaces(2).toNumber(),
    },
    refunds: {
      returnCredits: returnCredits.toDecimalPlaces(2).toNumber(),
      returnCancellations: returnCancellations.toDecimalPlaces(2).toNumber(),
      voidReversals: voidReversals.toDecimalPlaces(2).toNumber(),
      statementReturns: statementReturns.toDecimalPlaces(2).toNumber(),
      statementCashRefunds: statementCashRefunds.toDecimalPlaces(2).toNumber(),
      nonCashStatementRefunds: statementReturns
        .minus(statementCashRefunds)
        .toDecimalPlaces(2)
        .toNumber(),
      ledgerReturnNet: ledgerReturnNet.toDecimalPlaces(2).toNumber(),
      variance: returnVariance.toDecimalPlaces(2).toNumber(),
    },
    openingBalancesExcluded: new Decimal(input.openingBalancesExcluded.toString())
      .toDecimalPlaces(2)
      .toNumber(),
    exceptions,
  };
}

/**
 * Split refunds into cash-impacting (CASH, CARD_REVERSAL) and non-cash
 * (STORE_CREDIT, EXCHANGE) so a cash-flow report never deducts credit refunds
 * that never left an account (ARGUS #417).
 */
export function splitCashRefunds(refunds: RefundMethodTotal[]): {
  total: number;
  cash: number;
  nonCash: number;
  byMethod: Array<{ method: string; total: string }>;
} {
  let total = new Decimal(0);
  let cash = new Decimal(0);
  const byMethod = refunds.map((row) => {
    const amount = new Decimal(row.total.toString());
    total = total.plus(amount);
    if (row.method === 'CASH' || row.method === 'CARD_REVERSAL') {
      cash = cash.plus(amount);
    }
    return { method: row.method, total: amount.toFixed(2) };
  });

  return {
    total: total.toDecimalPlaces(2).toNumber(),
    cash: cash.toDecimalPlaces(2).toNumber(),
    nonCash: total.minus(cash).toDecimalPlaces(2).toNumber(),
    byMethod,
  };
}
