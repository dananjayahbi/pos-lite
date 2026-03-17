# Task 03.03.01 — Create Return and StoreCredit Prisma Models

## Metadata

| Field          | Value                                          |
| -------------- | ---------------------------------------------- |
| Task ID        | 03.03.01                                       |
| Name           | Create Return and StoreCredit Prisma Models    |
| SubPhase       | 03.03 — Returns and Exchanges                  |
| Status         | Not Started                                    |
| Complexity     | MEDIUM                                         |
| Dependencies   | SubPhase_03_01 complete, SubPhase_03_02 complete |
| Output Files   | prisma/schema.prisma (modified), prisma/migrations/[timestamp]_add_return_and_storecredit_models/ |

---

## Objective

Define the three new Prisma models required for the returns and exchanges subsystem — `Return`, `ReturnLine`, and `StoreCredit` — along with two new enums (`ReturnRefundMethod` and `ReturnStatus`). Also add the `linkedReturnId` nullable FK field to the existing `Sale` model to support exchange tracking. Run the Prisma migration to apply all changes to the development database.

---

## Context

These models form the data foundation of the entire SubPhase_03_03 feature set. No service, API route, or UI component in this SubPhase can be built correctly until this migration is applied and verified. The schema is designed to be append-only at this stage — existing `Sale`, `SaleLine`, `Payment`, and `Shift` models are only lightly modified (the `Sale` model receives one nullable field).

The `StockMovementReason.SALE_RETURN` enum value already exists from a previous migration and is the reason code passed to `adjustStock` when processing returns with restocking enabled.

---

## Step 1 — Add New Enums

Add the following two enums to `prisma/schema.prisma`, placed near the existing `PaymentMethod` and `SaleStatus` enums for organisational consistency.

**ReturnRefundMethod** specifies how the monetary value of a return is settled with the customer:

| Value          | Description                                                       |
| -------------- | ----------------------------------------------------------------- |
| CASH           | Cash disbursed from the drawer to the customer immediately        |
| CARD_REVERSAL  | Manual reversal on the card terminal; reference number recorded   |
| STORE_CREDIT   | A `StoreCredit` record is created; redeemable in Phase 04        |
| EXCHANGE       | Return value applied as credit against a new replacement cart     |

**ReturnStatus** describes the final state of a return record. In Phase 03 all returns are stamped `COMPLETED` at creation time:

| Value     | Description                                                                    |
| --------- | ------------------------------------------------------------------------------ |
| COMPLETED | All requested lines were returned and (if enabled) restocked in one transaction |

---

## Step 2 — Define the Return Model

Add the `Return` model to `schema.prisma`. The field specification is:

| Field             | Type                  | Constraints / Notes                                           |
| ----------------- | --------------------- | ------------------------------------------------------------- |
| id                | String                | `@id @default(cuid())`                                        |
| tenantId          | String                | FK → Tenant                                                   |
| originalSaleId    | String                | FK → Sale, `onDelete: Restrict` (sale cannot be deleted if a return exists) |
| initiatedById     | String                | FK → User — the cashier who opened the wizard                 |
| authorizedById    | String                | FK → User — must be MANAGER or SUPER_ADMIN; always required   |
| refundMethod      | ReturnRefundMethod    | Enum                                                          |
| refundAmount      | Decimal               | `@db.Decimal(12,2)`                                           |
| restockItems      | Boolean               | `@default(true)`                                              |
| reason            | String                | Free-text reason entered by cashier (max 200 chars enforced at API) |
| status            | ReturnStatus          | `@default(COMPLETED)`                                         |
| createdAt         | DateTime              | `@default(now())`                                             |
| lines             | ReturnLine[]          | Relation                                                      |
| originalSale      | Sale                  | Relation                                                      |
| initiatedBy       | User                  | Relation                                                      |
| authorizedBy      | User                  | Relation (named relation to avoid User FK ambiguity)          |

Add these indexes on the `Return` model:

- `@@index([tenantId, createdAt])` — powers the Return History page date-range queries
- `@@index([originalSaleId])` — powers the lookup of "all returns for a given sale" used by `getRemainingReturnableQty`

---

## Step 3 — Define the ReturnLine Model

Add the `ReturnLine` model to `schema.prisma`:

| Field                        | Type     | Constraints / Notes                                               |
| ---------------------------- | -------- | ----------------------------------------------------------------- |
| id                           | String   | `@id @default(cuid())`                                            |
| returnId                     | String   | FK → Return, `onDelete: Cascade`                                  |
| originalSaleLineId           | String   | FK → SaleLine — identifies which original line this reverses      |
| variantId                    | String   | Denormalized for display without join                             |
| productNameSnapshot          | String   | Copied from `SaleLine.productNameSnapshot` at return time        |
| variantDescriptionSnapshot   | String   | Copied from `SaleLine.variantDescriptionSnapshot` at return time |
| quantity                     | Int      | Number of units being returned on this line                       |
| unitPrice                    | Decimal  | `@db.Decimal(12,2)` — copied from the original SaleLine         |
| lineRefundAmount             | Decimal  | `@db.Decimal(12,2)` — computed proportional refund amount        |
| isRestocked                  | Boolean  | `@default(false)` — set to true per-line after adjustStock        |
| createdAt                    | DateTime | `@default(now())`                                                 |
| return                       | Return   | Relation                                                          |
| originalSaleLine             | SaleLine | Relation                                                          |

Add the index `@@index([returnId])` — powers eager loading of lines for a given return.

---

## Step 4 — Define the StoreCredit Model

Add the `StoreCredit` model to `schema.prisma`:

| Field      | Type      | Constraints / Notes                                                       |
| ---------- | --------- | ------------------------------------------------------------------------- |
| id         | String    | `@id @default(cuid())`                                                    |
| tenantId   | String    | FK → Tenant                                                               |
| customerId | String?   | Nullable FK → Customer (Phase 04 will populate this)                     |
| amount     | Decimal   | `@db.Decimal(12,2)` — original issued amount                             |
| usedAmount | Decimal   | `@db.Decimal(12,2) @default(0.00)` — incremented by Phase 04 redemption |
| note       | String?   | Optional free-text note; auto-populated as "Return [returnId]"           |
| expiresAt  | DateTime? | Optional expiry; nullable and not enforced in Phase 03                   |
| createdAt  | DateTime  | `@default(now())`                                                         |
| tenant     | Tenant    | Relation                                                                  |

Add the index `@@index([tenantId])` — powers tenant-scoped store credit lookups in Phase 04.

---

## Step 5 — Update the Sale Model

Add one nullable field to the existing `Sale` model:

| Field           | Type    | Constraints / Notes                                                  |
| --------------- | ------- | -------------------------------------------------------------------- |
| linkedReturnId  | String? | Nullable FK → Return, `onDelete: SetNull`                            |

This field is `null` on all ordinary sales. It is populated only when a sale is the replacement cart of an exchange. `onDelete: SetNull` ensures that deleting a Return (which is never done in production but is possible in dev seeding) does not cascade-delete the downstream sale.

Also add the relation field `linkedReturn Return? @relation(...)` to the `Sale` model, and add the inverse relation `linkedSales Sale[]` on the `Return` model.

---

## Step 6 — Run the Migration

After saving `schema.prisma`, run the migration by executing `pnpm prisma migrate dev` with the migration name `add_return_and_storecredit_models` in the terminal. Prisma will:

- Detect all schema changes made in Steps 1–5
- Generate a timestamped migration directory under `prisma/migrations/`
- Apply the migration SQL to the development database
- Regenerate the Prisma Client

If Prisma reports a shadow database drift error, it means the database is out of sync with existing migrations. In that case, run `pnpm prisma migrate reset` to reset the dev database and re-apply all migrations from scratch before re-running the migration command.

---

## Immutability Principle for ReturnLine

`ReturnLine` records must never be updated after creation except for the single `isRestocked` field. This constraint is enforced by convention (not by a database-level trigger) and is stated here so all future developers are aware:

- `productNameSnapshot`, `variantDescriptionSnapshot`, `unitPrice`, `lineRefundAmount`, `quantity`, and `originalSaleLineId` are written once during `initiateReturn` and must never be modified.
- The `isRestocked` field is the only mutable field, and it transitions only from `false` to `true` — never the reverse.

The reason for this constraint is operational auditability under partial transaction failure. If the Prisma `$transaction` in `initiateReturn` partially succeeds (for example, three lines are restocked and the fourth throws), the `isRestocked=false` lines are the explicit signal that the restock for those lines did not complete. This is discoverable via a simple query on `ReturnLine where returnId = X and isRestocked = false`. If the line records were mutable, this signal would be obscured.

---

## Why EXCHANGE Is a RefundMethod, Not a Separate Model

The `EXCHANGE` value in `ReturnRefundMethod` is architecturally a refund method label, not a separate workflow. The "exchange" in VelvetPOS is the composition of a completed Return followed by a new Sale — not an entity in its own right. By placing `EXCHANGE` in `ReturnRefundMethod`, the schema captures the intent of the return (the customer is exchanging, not taking cash) while the linkage to the replacement cart is tracked separately via `Sale.linkedReturnId`. This avoids:

- A three-way join table (Exchange → Return → Sale)
- A partially-completed Exchange state that would require its own status machine
- Inconsistency between exchange totals in Return reports and Sale reports

The trade-off is that the exchange link is one-directional: you can find the replacement sale from the return (query `Sale where linkedReturnId = X`), but not the reverse without fetching the Return first. This is acceptable for Phase 03 reporting requirements.

---

## Expected Output

- `prisma/schema.prisma` contains `Return`, `ReturnLine`, `StoreCredit` models; `ReturnRefundMethod` and `ReturnStatus` enums; updated `Sale` model with `linkedReturnId`
- `prisma/migrations/[timestamp]_add_return_and_storecredit_models/migration.sql` exists
- All models are visible in Prisma Studio after running `pnpm prisma studio`

---

## Validation Criteria

- [ ] `pnpm prisma migrate dev --name add_return_and_storecredit_models` completes without error
- [ ] Prisma Studio shows `Return`, `ReturnLine`, and `StoreCredit` tables
- [ ] `Sale` table has a `linkedReturnId` nullable column in Prisma Studio
- [ ] No existing seed data is broken by the migration (run `pnpm prisma db seed` and verify)
- [ ] Running `pnpm tsc --noEmit` reports no new TypeScript errors after client regeneration
