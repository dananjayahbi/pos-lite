# Dashboard stock movement reason labels (ARGUS #45)

The Recent Stock Movements card kept a private reason map that stopped before
`SALE` and `VOID_REVERSAL`, so the two most common rows rendered the raw enum
token next to the nicely labelled ones.

## Rule

`movementReasonBadge()` in
`src/components/dashboard/movementReasonBadge.ts` now covers every
`STOCK_MOVEMENT_REASONS` member and returns both the label and the badge class:

| reason | label |
| --- | --- |
| `SALE` | Sale |
| `VOID_REVERSAL` | Void reversal |
| `MANUFACTURED` | Manufactured |
| `WEBSITE_ORDER` | Website Order |

Unknown future values fall back to the shared
`stockMovementReasonLabel()` helper and the neutral badge class instead of
leaking an unhandled token.
