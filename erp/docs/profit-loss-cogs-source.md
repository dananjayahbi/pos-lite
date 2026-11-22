# Historical COGS source (ARGUS #436)

`SaleLine.costPriceSnapshot` captures the cost at the moment of sale, but only
13 of 72 completed sale lines had one. The P&L query used:

```sql
COALESCE(sl."costPriceSnapshot", pv."costPrice") * sl."quantity"
```

so a future edit to the variant's cost price silently rewrote profit for every
historical line without a snapshot. Returned COGS used the same fallback.

## Rule

The P&L now queries snapshot and fallback cost separately:

- snapshot lines contribute `costPriceSnapshot * quantity`;
- lines with no snapshot contribute `current costPrice * quantity` and are
  reported as a distinct fallback population.

`summarizeCogsSource` in `src/lib/reports/cogsSource.ts` returns total,
snapshot/fallback values, line counts, fallback percentage and a caveat string.
The API returns `cogsQuality.sales` and `cogsQuality.returned`; the page shows
an amber warning with the fallback line count and value, plus separate
snapshot/fallback rows in the COGS section. The warning is also included in
report export rows.

Nothing is silently mixed: a period with any fallback COGS always carries the
caveat.

## Verification

`src/lib/reports/__tests__/cogsSource.test.ts` covers an all-snapshot period, a
mixed period (13 snapshot / 59 fallback) including the percentage and caveat,
and an empty period.

## Residual

Historical lines without a snapshot still need the current-cost fallback until a
backfill (or supplier-cost history) is available. This task makes the exposure
visible rather than fabricating a historical cost.
