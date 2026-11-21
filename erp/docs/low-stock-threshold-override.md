# Low-stock override shows one effective threshold (ARGUS #214)

Raising the threshold override to 50 expanded the list (the SQL predicate used
50) but the table still printed each variant's own threshold (for example 5)
while Shortfall was computed from 50. The subtitle still described per-variant
thresholds, and the CSV repeated the same mismatch.

## Behaviour

`src/lib/inventory/lowStockThreshold.ts` defines the shared view:

- `resolveEffectiveLowStockThreshold(variantThreshold, override)` returns the
  applied value and whether it came from the override.
- `lowStockThresholdRuleLabel(override)` produces the subtitle sentence:
  "Variants at or below the 50-unit override threshold" or "Variants at or
  below each variant's own low stock threshold".
- `lowStockThresholdCellLabel` renders `50 (override)` or the variant value.

The low-stock API now returns `effective_threshold` on each row (the override
when supplied, else the variant threshold). The table displays that value, and
Shortfall is computed against it, so Current Stock, Threshold and Shortfall
reconcile. With no override, the effective value equals the variant threshold
and the column looks unchanged.

## CSV

The export replaces the single `Threshold` column with:

- `Threshold Applied` - the override when active, else the variant threshold;
- `Variant Threshold` - the variant's own configured threshold.

That keeps both numbers auditable and removes the "Shortfall uses 50, Threshold
says 5" mismatch.

Tests: `src/lib/inventory/__tests__/lowStockThreshold.test.ts`.
