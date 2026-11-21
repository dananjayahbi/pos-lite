# Appointment fixture cleanup

The live tenant's appointment module is dominated by QA fixtures: 68 cancelled
appointments, a handful of overdue/far-future test bookings (one with a
200-character title), DeleteMe services, and ~70 pending reminders. There is no
real service catalogue or bookable schedule (ARGUS #122).

## Classifier

`src/lib/appointments/fixtures.core.ts` recognises only obvious fixture markers:

- titles/walk-ins starting with `QA`, `Test`, `F<number>`, `Module <number>`, or
  containing `DeleteMe`;
- any title longer than 120 characters (the reported fixture);
- services starting with `QA`/`Test` or containing `DeleteMe`. Real service
  names are never matched.

## Cleanup CLI

Run from `erp/`:

```bash
npx tsx scripts/cleanup-appointment-fixtures.ts                  # dry run
npx tsx scripts/cleanup-appointment-fixtures.ts --apply          # delete safe fixtures
npx tsx scripts/cleanup-appointment-fixtures.ts --tenant=<id>    # one tenant only
npx tsx scripts/cleanup-appointment-fixtures.ts --include-active # also scheduled fixtures
```

Safety rules:

- Appointments linked to a sale are always skipped (never delete financial
  history).
- Only `CANCELLED` / `NO_SHOW` fixtures are deleted unless `--include-active` is
  passed deliberately.
- Reminders are deleted first, the slot is freed, then the appointment row is
  deleted; ambiguous/active fixture rows are listed for a human.
- Fixture services are soft-deleted (`deletedAt`, `isActive=false`) only when no
  appointment still references them.
- Nothing is modified without `--apply`.

After cleanup, recreate a real service catalogue and staff availability through
the normal settings UI; the script deliberately does not invent catalogue data.
