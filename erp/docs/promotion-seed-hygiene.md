# Promotion data hygiene

The live tenant had three active promotions with no start or end date; "10% Off
Everything" therefore applied to every cart, and the 15% category promotion
looked inert at the POS (that matching issue was fixed separately in #323)
(ARGUS #68).

Open-ended promotions are legitimate (seasonal or always-on offers), so this
change does not delete or deactivate anything. It makes the state visible:

- **Promotions page**: a warning lists active promotions with no date window and
  BOGO/Mix promotions with no product/category target (which can never apply).
- **Audit CLI** (read-only, from `erp/`):
  ```bash
  npx tsx scripts/audit-promotions.ts
  npx tsx scripts/audit-promotions.ts --tenant=<id>
  ```
  Prints open-ended active promotions, untargeted BOGO/Mix rows, and promotions
  expiring within seven days. It modifies nothing; adding dates, targets or
  deactivating a campaign remains an explicit operator action.

`auditPromotions` (`src/lib/services/promotionHygiene.core.ts`) is pure and
tested in `promotionHygiene.core.test.ts` (open-ended, dated, inactive,
untargeted, targeted, expiring-soon).

The seeded 10% cart and 15% category promotions are intended as always-on demo
data; confirm with the operator before adding windows. No seed data is changed
automatically.
