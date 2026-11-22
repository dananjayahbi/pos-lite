# Commission payout presentation (ARGUS #370)

`CommissionPayout.totalEarned` stores the money actually paid by the payout, so
a partial payout stores the paid part, not the period's earnings. The API now
returns both:

- `amountPaid` - the accurate name, used by the page and receipt; and
- `totalEarned` - kept for older clients.

Renaming the database column would need a migration, which this change avoids.

Dates come from `src/lib/services/commissionPayoutPresentation.core.ts` and use
en-GB/en-LK (`14 Nov 2026`, `14 Nov 2026, 09:05`) instead of the browser-default
`toLocaleString()`.

Payout history is paginated (20 per page) using the existing `page`/`pageSize`
query contract; the page shows Previous/Next and resets to page 1 when the
commission period changes. The default period remains the current local month
(`resolveCommissionPeriod`, ARGUS #343) rather than the UTC month.
