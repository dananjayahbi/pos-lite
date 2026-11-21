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
