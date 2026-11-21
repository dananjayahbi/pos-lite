/**
 * COGS source quality (ARGUS #436).
 *
 * Sale lines capture `costPriceSnapshot` at the moment of sale. Legacy lines
 * have no snapshot, so the P&L falls back to the variant's CURRENT cost price.
 * That fallback is unavoidable for historical rows, but it must be visible:
 * a future cost edit would otherwise silently rewrite past profit.
 */
type Decimalish = number | string | { toString(): string };

export interface CogsSourceInput {
  snapshotCogs: Decimalish;
  fallbackCogs: Decimalish;
  snapshotLines: number;
  fallbackLines: number;
}

export interface CogsSourceSummary {
  /** Snapshot + fallback COGS. */
  total: number;
  snapshotCogs: number;
  fallbackCogs: number;
  snapshotLines: number;
  fallbackLines: number;
  totalLines: number;
  /** True when at least one line used the current-cost fallback. */
  usesFallback: boolean;
  /** Percentage of total COGS that came from current-cost fallback. */
  fallbackPercent: number;
  /** Ready-to-display caveat, or null when every line had a snapshot. */
  caveat: string | null;
}

export function summarizeCogsSource(input: CogsSourceInput): CogsSourceSummary {
  const snapshotCogs = Number(input.snapshotCogs.toString());
  const fallbackCogs = Number(input.fallbackCogs.toString());
  const snapshotLines = Math.max(0, Number(input.snapshotLines) || 0);
  const fallbackLines = Math.max(0, Number(input.fallbackLines) || 0);
  const total = snapshotCogs + fallbackCogs;
  const totalLines = snapshotLines + fallbackLines;
  const usesFallback = fallbackLines > 0 || fallbackCogs !== 0;
  const fallbackPercent =
    total > 0 ? Math.round((fallbackCogs / total) * 10000) / 100 : 0;

  const caveat = usesFallback
    ? `Includes current-cost fallback for ${fallbackLines} sale line(s) worth Rs ${fallbackCogs.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} because no cost snapshot was captured. Past profit will change if product costs are edited.`
    : null;

  return {
    total: round2(total),
    snapshotCogs: round2(snapshotCogs),
    fallbackCogs: round2(fallbackCogs),
    snapshotLines,
    fallbackLines,
    totalLines,
    usesFallback,
    fallbackPercent,
    caveat,
  };
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
