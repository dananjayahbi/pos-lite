# Revenue Trend charts

`/reports/revenue-trend` (API `GET /api/reports/revenue-trend`) has two charts
below the stat cards. Both used percentage heights inside auto-height flex
items, which CSS resolves to `0` — the elements existed but had no visible
size. That is why the QA saw blank charts while the stat cards (plain text)
were correct.

## Revenue & Returns (Issue #9.1, Issue #15)

- The chart now uses **Recharts** (`LineChart` with two `Line`s) instead of the
  hand-rolled SVG. The old SVG used `viewBox="0 0 100 100"` with
  `preserveAspectRatio="none"`, which stretched strokes and squeezed the x-axis;
  a single-point `<polyline>` also drew nothing.
- **Zero-filled, calendar-aligned series:** the API only returns buckets that
  have sales or returns, so a 30-day range with activity on four days arrived as
  four equally spaced points joined by long straight lines. `buildRevenueSeries`
  (`src/lib/reports/revenue-trend.ts`) now fills every day/week/month bucket in
  the selected range with zeros before plotting.
- The x-axis is a true numeric time axis with six evenly spaced ticks (UTC),
  tooltips show the full bucket date plus revenue/returns, and dots are only
  drawn when the range has 31 buckets or fewer.
- The single-bucket case (Monthly over one month) still renders two markers
  (revenue + returns) because the domain is padded by 12 hours on each side.
- Buckets still come from the API as `timeSeries: [{ date, revenue, returns,
  transactions }]`; stats and peak hours are unchanged.

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

- `src/lib/reports/__tests__/revenue-trend.test.ts` — bucket flooring (day /
  ISO week / month), zero-fill across daily, weekly and monthly ranges,
  duplicate summing, out-of-range filtering, malformed amounts and axis ticks.
- `tests/47_revenue_trend_chart.spec.ts`:
  - `F1` — daily range renders ≥30 plotted markers, ≥4 x-axis date ticks and
    multiple zero-revenue dots sitting on the baseline.
  - `F2` — Monthly with a single bucket renders two markers; weekly renders
    every week in the range.
- `tests/34_reports_analytics.spec.ts` §9:
  - `P9` — monthly single-month range returns ≥1 bucket.
  - `P10` — peak hours cover all 24 hours and their counts sum to the reported
    transaction total.
  - `P11` — the rendered page contains an SVG data point and non-zero-height
    peak-hour bars in Monthly mode.
