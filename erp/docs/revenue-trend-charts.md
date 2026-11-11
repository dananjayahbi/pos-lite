# Revenue Trend charts

`/reports/revenue-trend` (API `GET /api/reports/revenue-trend`) has two charts
below the stat cards. Both used percentage heights inside auto-height flex
items, which CSS resolves to `0` — the elements existed but had no visible
size. That is why the QA saw blank charts while the stat cards (plain text)
were correct.

## Revenue & Returns (Issue #9.1)

- The chart is a hand-rolled SVG. A `<polyline>` with one point draws nothing,
  so **Monthly over a single-month range** (one bucket) was invisible. The
  chart now draws:
  - bars for the one-bucket case (revenue and returns), and
  - a dot for every bucket in all cases (with a `<title>` tooltip).
- Multi-bucket ranges keep the existing revenue line + dashed returns line.
- Buckets come from the API unchanged: `timeSeries: [{ date, revenue, returns,
  transactions }]`.

## Peak Sales Hours (Issue #9.2)

- Bars now use a fixed 112px bar area with per-bar pixel heights instead of
  `height: %` inside an auto-height column, so every configured hour renders.
- If a period has transactions but no revenue (e.g. zero-value sales), the
  chart falls back to transaction counts so activity is still visible.
- **Timezone:** `createdAt` is stored in UTC. The SQL now groups with
  `createdAt AT TIME ZONE <tenant timezone>` (from `tenant.settings.timezone`,
  defaulting to UTC if unset/invalid), so a 9am Colombo sale appears in the 9am
  bucket rather than 3am.
- The 24-hour series is always returned (0 for empty hours); the sum of
  `peakHours[].count` equals `stats.totalTransactions` for the period.

## Verification

- `tests/34_reports_analytics.spec.ts` §9:
  - `P9` — monthly single-month range returns ≥1 bucket.
  - `P10` — peak hours cover all 24 hours and their counts sum to the reported
    transaction total.
  - `P11` — the rendered page contains an SVG data point and non-zero-height
    peak-hour bars in Monthly mode.
