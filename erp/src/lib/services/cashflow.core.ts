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
