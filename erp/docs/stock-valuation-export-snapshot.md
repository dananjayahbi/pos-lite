# Stock Valuation export uses the displayed snapshot (ARGUS #223)

The page caches the valuation for five minutes but Export used to call the
endpoint live, so a download after a stock change could disagree with the cards;
the CSV also had no "as of" timestamp.

- `src/lib/pricing/valuationCsv.core.ts` owns `buildValuationCsv()` and
  `valuationCsvFilename()`.
- The client passes the `valuation` object already rendered on screen, so the
  file is byte-for-byte the same snapshot as the KPI cards and table.
- The server route (still available for direct `?format=csv` calls) builds the
  file from the snapshot it just computed and returns the same
  `calculatedAt` in JSON and CSV.
- The CSV starts with `As of,<calculatedAt ISO>` and the filename is
  `stock-valuation-YYYY-MM-DD-HHmm.csv` (UTC), so two exports from the same day
  are distinguishable.
- The category table still ends with the reconciled `Total` row.
