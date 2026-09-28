# Lifecycle Policy — Archive, Soft Delete, Hard Delete, Restore

**Status:** canonical · **Owner:** XC-05 · **Last verified:** 2026-09-17

This document is the single vocabulary for what happens when a user "deletes"
something, and what reversibility we promise. Every user-facing Delete/Archive
control must map to exactly one of the three mechanisms below, and every promise
in the UI must have a real restore path (XC-05 exists because Product's DELETE
copy promised restorability with no route that cleared `deletedAt`).

---

## 1. The three mechanisms

### Archive (`isActive: false` / `isArchived: true`)

- **Meaning:** "take it out of the working set, keep it fully addressable."
- **Visibility:** still listed, normally behind an `Archived` / `Inactive` filter.
- **Reversibility:** fully reversible, by the same or a lesser permission than
  the archive action. This is the default choice.
- **Why prefer it:** no uniqueness leak, no referential surprises, the row keeps
  appearing in reports and historical joins.
- **Used by:** Supplier (`isActive`), Staff/User (`isActive`), Product
  (`isArchived` — the archive half of its dual flag).

### Soft delete (`deletedAt: DateTime?`)

- **Meaning:** "behave as if gone; retain the bytes."
- **Visibility:** hidden from every normal query — filters MUST include
  `deletedAt: null`.
- **Reversibility:** restorable by an authorized actor, and **only** via an
  explicit restore route. If a surface offers Soft delete, a restore path is
  mandatory — an unreachable soft delete is just a slow hard delete with a
  confusing name.
- **Uniqueness:** a soft-deleted row **keeps reserving** its unique name (see §3).
- **Used by:** Category, Brand, Customer, Product (the `deletedAt` half),
  ProductVariant, RawMaterial, PackagingItem, WebhookEndpoint, Delivery,
  AppointmentService, Tenant, BillOfMaterials.

### Hard delete

- **Meaning:** the row is gone.
- **Allowed only when** the data is transient or configuration-scoped AND the
  loss is deliberate and recorded. Never for anything that carries financial,
  audit, or ledger meaning.
- **Currently allowed for:**
  - `WebsiteConfig` child collections — hero slides and ads are *presentation
    configuration*, replaced wholesale by the CMS. (Note: `DELETE /website`
    resets the config itself; the reset is not restorable, and the settings page
    must not imply otherwise.)
  - Transient join/scratch rows created and dropped within one workflow (e.g. a
    stock-take draft).
- **Never allowed for:** Sale, SaleLine, Return, Payment, AuditLog, StockMovement,
  WebhookDelivery, PurchaseOrder, DailySummaryLog.

---

## 2. No-delete entities (append-only)

Some entities deliberately have no delete of any kind. A 405 from these routes is
correct behaviour, not a gap.

| Entity | Contract |
|---|---|
| `AuditLog` | append-only; only `GET` exists. Mutations are 405 (tests/35 A1/A2). |
| `StockMovement` | the movements ledger is the inventory source of truth; corrections are *new* movements with a reason. |
| `Sale` / `SaleLine` | never deleted; `VOIDED` is a status, not a removal. Voiding is itself audited. |
| `Return` | append-only; refunds are new rows. |
| `Batch` | permanent receipt records (OBS-83, deliberate). |
| `DailySummaryLog` | the delivery ledger; a non-delivery is recorded as `PENDING`/`FAILED`, never removed (M35-02). |

---

## 3. Recreate-after-soft-delete (the one chosen policy)

**Policy: a soft-deleted row KEEPS RESERVING its unique name.** Creating a new
row with the same name returns a **friendly `409 CONFLICT`** that names the
conflict and points at the restore path.

Rationale: unreserving the name on delete makes "delete then recreate the same
name" a silent data-fork — two rows with one identity, one of them invisible.
Categories and brands already behaved this way; the policy makes that the rule
for everyone rather than an accident of which entity happened to have a unique
constraint.

Consequences to honour:

- The 409 message is user-facing: it states the name is taken *by a hidden
  (deleted) record* and offers restore, not a bare "already exists".
- Where no restore route exists yet, the 409 points at support/rename until one
  is added. **A reserved name with no restore path is debt** — record it, don't
  hide it.
- The inverse (Customer today: `deletedAt` set, phone not unique → recreate
  succeeds with **201**) is a policy violation to converge, not a precedent.

---

## 4. Restore affordances

| Entity | Restore mechanism | State |
|---|---|---|
| Product | Restore clears `deletedAt` (and leaves `isArchived` under the operator's control) | M02-03 defines it; the archive route must NOT 404 on a deleted row |
| Supplier | Unarchive (`isActive: true`) | M06-05 |
| Category / Brand | Restore-or-rename flow, or reserved-name 409 with a clear message | client decision (D-series) |
| Customer | Restore clears `deletedAt` and `isActive` | pending per-entity work |
| WebhookEndpoint | Soft delete retains the ledger; the endpoint row remains addressable for audit | M33-03 (done) |
| Staff / User | `deletedAt` set by a guarded deprovision route; audit rows persist (they reference `actorId`, not the user row) | GAP-4 |

---

## 5. Rules for implementers

1. **Never** write a query that reads a soft-deletable model without deciding
   explicitly: `deletedAt: null` in the `where`, and a comment saying why if it
   is omitted.
2. **Never** ship a "Delete" button that resolves to Hard delete unless §1 lists
   the entity there. Use Archive by default; Soft delete when history matters.
3. **Always** ship the restore path in the same change as the delete. A delete
   without a documented restore is a policy violation.
4. **Audit** every delete, restore, and deprovision with the acting user — the
   audit row outlives the entity (it references `actorId`, never a cascade).
5. **Cascades are for ledgers you intend to lose.** Deleting a parent must not
   destroy an append-only child (this is exactly why `WebhookEndpoint` moved off
   hard delete in M33-03).
6. **Confirm dialogs match the mechanism** — "Archive" and "Move to trash" are
   honest; "Delete" may only be used for a mechanism that is actually reversible
   or genuinely destructive-and-stated-as-such.