# M09-03 — Stock-adjustment ergonomics bundle: OBS-18 scanner-Enter dismiss, OBS-19 zero-delta schema asymmetry, OBS-22 reason-chip exclusion model

**Severity:** P3 bundle (UX + schema hygiene) · **Module:** 09 Stock Movements · **QA refs:** H1 pin (no trailing Enter), X2 pin (zero-delta), F8 (chips) · **Depends on:** nothing

## Verified source state (2026-09-15)
1. **OBS-19 (schema asymmetry — confirmed):** `src/lib/validators/product.validators.ts:164-169` `StockAdjustmentSchema.quantityDelta = z.number().int()` — **no `≠0` refine**, while `bulk-adjust/route.ts:14` has `.refine(v => v !== 0)`. Single-adjust accepts 0 → writes a 0-delta row into the immutable ledger (noise; QA X2 pins current behavior).
2. **OBS-18 (scanner Enter — holds):** `src/app/(store)/stock-control/adjust/` product-search popover (Radix) dismisses on Enter without selecting — the universal hardware-scanner terminator closes results instead of choosing the top hit. QA H1 types bursts WITHOUT Enter to work around.
3. **OBS-22 (chips — holds):** `/stock-control/movements` reason chips are an *exclusion* model (all selected; click deselects; pill "N of 11 reasons") while the API `reasons=` param is an allowlist — coherent but reads inverted.

## Fix approach
1. **Align schemas:** add the `≠0` refine to `StockAdjustmentSchema` (single + shared with M09-02's upper-bound edit — same validator file, one PR). Zero-delta → 400. Flip X2.
2. **Scanner UX:** in the adjust-form search popover, Enter selects the first highlighted result (Radix `Combobox` `onSelect` on Enter) instead of dismissing; keep Escape = dismiss. Verify against the barcode-first flow on `/inventory` which already handles bursts (02 spec H10).
3. **Chips:** either relabel to match behavior ("Showing 10 of 11 reasons — click to exclude") or invert to click-to-include. Recommend label fix (cheaper, no API churn); record decision.

## Files
- `product.validators.ts`, adjust-form popover component, movements page chip component.

## Acceptance / gate
- X2 flips (0-delta → 400, no ledger row); H1 extended with an Enter-terminates burst selecting the top product; chip copy updated (UI assertion).
