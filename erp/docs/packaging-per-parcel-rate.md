# Packaging per-parcel rate display

ARGUS #285.

`packagingConsumptionUnits` deducts whole units and rounds half-up, never less
than one (`1.6 → 2`, `0.5 → 1`). The Packaging Stock table printed the raw
configured decimal (`1.60`), so the live rate implied 1.6 m per parcel while a
dispatch removed 2 m. The Playwright label also said "rounds consumption down"
even though the code rounds up.

- `resolvePackagingPerParcelRate` (pure, unit tested) returns the configured
  value, the effective whole-unit value and a `rounded` flag.
- The table's **Per Parcel** column now shows the effective consumption, e.g.
  `2 m / parcel`, with `1.6 configured, rounded up` underneath when they differ.
- The item form previews the deduction while typing the rate, so the operator
  sees what dispatch will actually remove.
- The Playwright test title now says "rounds consumption up".

The deduction helper itself is unchanged; this is presentation only.
