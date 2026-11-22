/**
 * ARGUS #408 - one honest answer to "is this tenant's petty cash usable?".
 *
 * The schema has no tenant-wide uniqueness constraint for `PettyCashFund`, so
 * historical lazy setup could leave more than one active fund. Reads must not
 * silently pick the first one. This pure helper classifies the result; the
 * service and API decide whether to flag it or fail.
 */
export interface PettyCashFundRef {
  id: string;
}

export type PettyCashReadiness =
  | { status: 'not-configured'; fundId: null; fundCount: 0 }
  | { status: 'ready'; fundId: string; fundCount: 1 }
  | { status: 'multiple'; fundId: null; fundCount: number };

export function resolvePettyCashReadiness(
  funds: readonly PettyCashFundRef[],
): PettyCashReadiness {
  const first = funds[0];
  if (!first) {
    return { status: 'not-configured', fundId: null, fundCount: 0 };
  }
  if (funds.length === 1) {
    return { status: 'ready', fundId: first.id, fundCount: 1 };
  }
  return { status: 'multiple', fundId: null, fundCount: funds.length };
}

export function multiplePettyCashFundsMessage(fundCount: number): string {
  return `This store has ${fundCount} active petty-cash funds. Resolve the duplicates before using petty cash.`;
}
