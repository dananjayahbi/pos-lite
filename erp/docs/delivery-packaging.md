# Delivery packaging stock

Module 23 — packaging consumables (courier bags, polymailers, tape, labels,
bubble wrap) tracked per parcel, plus automatic deduction on dispatch.

Pages: `/delivery/packaging`. Permissions: `delivery:packaging:manage` for
CRUD, `delivery:packaging:dispatch` for manual stock adjustments. Both are
gated by the `delivery` feature module.

## Categories

Categories are **tenant-managed rows** (`packaging_category_options`), not a
closed enum. The five built-in keys (`POLYMAILER`, `TAPE`, `LABEL`,
`BUBBLE_WRAP`, `OTHER`) are seeded lazily for every tenant and can be renamed
or deleted while they are unused.

- `GET /api/store/packaging-categories` — list with `usageCount`.
- `POST /api/store/packaging-categories` — `{ name }`; the key is slugified
  from the name (`Courier Bags` → `COURIER_BAGS`), suffixing `_2`, `_3`, … on
  collision. A previously soft-deleted key is revived instead of duplicated.
- `PATCH /api/store/packaging-categories/:id` — `{ name?, isActive? }`.
  Built-in keys can be renamed but not deactivated.
- `DELETE /api/store/packaging-categories/:id` — soft delete. Rejected with
  `CATEGORY_IN_USE` (409) while items reference the key, and `LAST_CATEGORY`
  (409) for the final category.

The UI exposes the same editor inline inside the Add/Edit Item dialog
("Manage" next to the Category select) and from the page-level **Categories**
button. Renaming keeps item references intact because items store the stable
`key`, not the display name.

Moving the column from the enum to `TEXT` is handled by
`prisma/migrations/20261101120000_add_packaging_categories`, which seeds the
built-ins for every tenant before altering the type. **The live dev database
has no `_prisma_migrations` history** (see README → _Schema drift_): apply the
migration SQL with `prisma db execute --file …` rather than `prisma db push`,
because `db push` would drop and re-add the column and lose category data.

## Items

`POST/PATCH /api/store/packaging[/:id]`:

| Field                                  | Notes                                                                                                                               |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `name`                                 | Required, ≤ 120 chars                                                                                                               |
| `category`                             | Category key; must exist for the tenant (`CATEGORY_NOT_FOUND`)                                                                      |
| `sku`                                  | Optional, ≤ 60 chars                                                                                                                |
| `autoGenerateSku`                      | Create-only. Derives `CATEGORY-NAME` (e.g. `BUBB-BUBBLE-WRAP-50M`) and suffix `-2`, `-3` on collision. On by default in the dialog. |
| `unit`                                 | `PIECE`, `ROLL`, `BOX`, `METER`                                                                                                     |
| `quantityOnHand` / `lowStockThreshold` | Non-negative integers, in the selected unit                                                                                         |
| `autoDeduct`                           | Include in per-parcel dispatch deduction                                                                                            |
| `consumptionPerParcel`                 | Decimal (6,2); defaults to `1` at deduction time — pass `null` to clear                                                             |

`DELETE /api/store/packaging/:id` soft-deletes the item, disables
auto-deduction and keeps consumption history. Every create/update/delete and
stock adjustment writes an audit row (`PACKAGING_*`).

The Add/Edit dialog labels stock fields with the selected unit (e.g. "Low
Stock At (m)" for `METER`). The Adjust dialog shows the **current stock** and
accepts the **new level**; the API still receives the derived integer `delta`
(`{ delta, note? }`), which stays the audited contract.

## Dispatch deduction

`autoDeductPackaging(tenantId, deliveryId, { tx })` runs **inside the same
transaction** that flips the delivery to `DISPATCHED` (both first dispatch and
recovery redelivery). A parcel can therefore never be marked dispatched with
its packaging stock left un-deducted; a failed deduction rolls the status
change back too.

- Only items with `autoDeduct = true` and `deletedAt = null` are consumed.
- Per parcel, the consumption is rounded half-up to whole units (1.6 → 2,
  0.5 → 1) with a floor of one unit; stock never goes negative.
- Insufficient stock does not block dispatch — the item is capped at its
  remaining stock and flagged `insufficient`.
- Each deduction writes a `PackagingConsumption` row.
- `notifyLowStock` runs after commit and warns when `quantityOnHand <=
lowStockThreshold` (threshold-based, not only at zero).

Permanently cancelling a failed delivery restores the consumed quantity to the
packaging items.
