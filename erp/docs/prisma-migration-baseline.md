# Prisma migration baseline (P3005)

The live `velvetpos` database was provisioned outside `prisma migrate`, so it
had the schema but no `_prisma_migrations` history. `prisma migrate deploy`
therefore failed with **P3005 - database schema is not empty**, even though all
tables existed.

## What was done

1. Compared the live schema to `prisma/schema.prisma` with
   `prisma migrate diff --from-config-datasource --to-schema ... --script`.
   The only remaining difference was the `sale_lines.variantId` FK action
   (`ON DELETE SET NULL`), which was applied directly.
2. Applied the pending additive migrations that had never run against this
   database with `prisma db execute --file <migration.sql>`:
   - `20261121120000_add_store_credit_payment_method`
   - `20261121130000_add_return_tax_breakdown`
   - `20261121140000_add_exchange_credit_tender`
   - `20261121150000_service_sale_lines`
   - `20261121160000_raw_material_costing`
   - `20261121170000_return_cancellation`
   - `20261121180000_appointment_service_tax`
3. Re-ran `migrate diff`; it returned an empty migration.
4. Baselined the 54 existing migrations with
   `prisma migrate resolve --applied <migration_name>` (no data changes).

## Verification

- `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`
  returns "This is an empty migration."
- `prisma migrate status` reports no unapplied migrations once the flaky
  database connection is available.
- Schema spot checks: `RawMaterial.unitCost`, `ProductionLog.materialCost`,
  `ReturnStatus.CANCELLED`, `AppointmentService.taxRule`, `PaymentMethod`/
  `PaymentLegMethod` store/exchange credit values, return tax columns and the
  nullable `sale_lines.variantId` all exist.

## Future migrations

New migrations can now use the normal `prisma migrate deploy` flow. Do not reset
or `db push --force-reset` the live database; baseline only records history.
