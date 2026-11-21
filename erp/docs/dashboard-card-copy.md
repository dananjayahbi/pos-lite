# Dashboard card copy (ARGUS #47)

## Low Stock Variants helper

The counter includes a variant whose stock equals its threshold
(`stockQuantity <= lowStockThreshold`), but the helper said "Variants already
below threshold". It now reads:

> Variants at or below threshold

This matches the KPI subtitle (`lowStockCardSubtitle()`), which already said
"at or below threshold". The count and link are unchanged.
