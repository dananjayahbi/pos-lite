# Commission rate contract

Commission rates have one contract: **0 to 100 percent inclusive** (ARGUS #342).

Before this, three surfaces disagreed:

- the form input capped at `max="100"`;
- the staff validator mirrored the `Decimal(5,2)` column and accepted up to
  `999.99`;
- `createCommissionRecord` rejected anything above `100`.

An account saved at 999.99% therefore looked valid in the directory but never
earned commission, and the sale-side catch merely logged a warning.

## Shared source

`src/lib/constants/commission-rate.ts`:

- `COMMISSION_RATE_MIN = 0`
- `COMMISSION_RATE_MAX = 100`
- `isValidCommissionRate(value)` - finite number in range
- `normalizeCommissionRate(value)` - parses stored strings, returns `null` when
  unusable so callers can skip commission instead of writing a dead record

## Consumers

| Surface | Behaviour |
| ------- | --------- |
| Staff create/edit form | `min=0` / `max=100`, same message |
| `CreateStaffSchema` / `UpdateStaffSchema` | rejects above 100 with `VALIDATION_ERROR` (HTTP 400) |
| `createCommissionRecord` | throws `400 VALIDATION_ERROR` above 100 |
| Sale and appointment conversion | normalises the stored rate; out-of-range legacy values are skipped with an explicit server warning, not a silent no-op |

The column stays `Decimal(5,2)`; narrowing the application contract does not
require a migration.

## Verification

- `src/lib/__tests__/commission-rate.test.ts` covers the validator boundaries
  and the 400-level rejection message.
- `src/lib/__tests__/commission-rate-contract.test.ts` covers the shared pure
  contract and legacy-value normalisation.
