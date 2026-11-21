# Appointment lifecycle actions (ARGUS #125)

The appointment detail panel now exposes the lifecycle the transition map
already defined, and the action sub-routes enforce those same edges.

## Actions

| From | Actions |
| --- | --- |
| `SCHEDULED` | **Confirm** (→ `CONFIRMED`); **Check In** only when the tenant's `requireConfirmation` setting allows it; No-show; Cancel |
| `CONFIRMED` | **Check In** (→ `CHECKED_IN`); No-show; Cancel |
| `CHECKED_IN` | **Start** (→ `IN_PROGRESS`); **Complete**; Cancel |
| `IN_PROGRESS` | **Complete**; Cancel |
| `COMPLETED` | Convert to Sale (when no sale is attached); otherwise "Sale recorded" |
| `NO_SHOW` / `CANCELLED` | **Rebook** — creates a new booking, never re-opens the terminal row |

`IN_PROGRESS` was previously unreachable because no action wrote it. The new
`POST /api/store/appointments/[id]/in-progress` route calls the existing
`markInProgress` service.

`POST /api/store/appointments/[id]/confirm` was added because default tenants
create bookings as `SCHEDULED` with `requireConfirmation: true`; without a
confirmation action the canonical map left them stuck there. When the tenant
sets `requireConfirmation: false`, `SCHEDULED` may be checked in directly, as
`appointmentSettings.core` already allowed.

## Permissions

`appointmentLifecycle.core` maps each action to the exact key(s) its API route
enforces, and `AppointmentActions` hides anything the signed-in user cannot do:

- Confirm / Start / Complete / No-show → `appointment:edit`
- Check In → `appointment:checkin`
- Cancel → `appointment:cancel`
- Rebook → `appointment:create`
- Convert to Sale → `appointment:edit` **and** `sale:create`

The server remains authoritative: `check-in`, `confirm`, `in-progress`,
`complete`, `no-show`, and `cancel` now validate the transition (cancellation
also keeps the ARGUS #120 sale/deposit guards).

## Cancel confirmation

Cancel opens a dialog with a required reason before calling the existing
`/cancel` endpoint. The endpoint's schema now rejects an empty reason with a
typed `VALIDATION_ERROR`; the service still records `cancelledAt/By`, the
reason, the deposit disposition and the audit entry from ARGUS #120.

## Rebook

Rebook on a `NO_SHOW` or `CANCELLED` appointment used to call check-in (setting
`CHECKED_IN`). It now opens the New Appointment form with the same customer,
service, staff and notes, moved forward one week (`buildAppointmentRebookSeed`),
so a brand-new booking is created through the normal create endpoint.

## Tests

`src/lib/appointments/__tests__/appointmentLifecycle.core.test.ts` covers the
permission mapping, legal/illegal edges under both confirmation settings,
rebook/conversion availability, the service sentinel, and the prefilled rebook
seed.
