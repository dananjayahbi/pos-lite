# Promotion live state

ARGUS #329. The promotions header, the "Active now" tile and the customer
pricing "active rules" count used `isActive` alone. A promotion whose start is
in the future, or whose end has already passed, still showed the switch on and
was counted as active. The "Scheduled windows" tile counted every dated row,
including expired ones.

## States

`src/lib/services/promotionLiveState.core.ts` defines one pure classifier:

| State | Meaning | Live? |
| --- | --- | --- |
| `ENABLED` | switch on, no date window (always applies) | yes |
| `SCHEDULED` | switch on, start is in the future | no |
| `ACTIVE_NOW` | switch on, now is inside the window | yes |
| `EXPIRED` | switch on, end has passed | no |
| `INACTIVE` | switch off (never applies) | no |

Expiry is checked before a future start, so a malformed legacy row with a past
end is never reported as scheduled. Invalid legacy date strings are treated as
open bounds instead of crashing the page.

## UI use

- Header: `X live promotion(s) now` counts `ENABLED + ACTIVE_NOW`.
- "Active now" tile: the same live count.
- Status column: a badge (`Enabled`, `Scheduled`, `Active now`, `Expired`,
  `Inactive`) sits beside the switch, so the switch can be on while the badge
  honestly says Scheduled/Expired.
- "Scheduled" tile: only `SCHEDULED`; expired rows are no longer counted.
- Customer pricing: the count and the row badge use the same helper, so a rule
  outside its window is not called active.

## Verification

- `src/lib/services/__tests__/promotionLiveState.core.test.ts`
