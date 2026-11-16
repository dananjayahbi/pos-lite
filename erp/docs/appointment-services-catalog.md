# Appointment services catalogue

Issue #26 — `/appointments/services`. The page previously rendered a bare list:
**Add Service** opened nothing, **Edit** opened an empty dialog with no service
data, **Delete** was a no-op, and prices were formatted in dollars. The screen is
now a complete, theme-consistent catalogue.

## 1. Layout

- Page header with the **Appointment Services** title, a short description and a
  permission-gated **Add service** action.
- Summary strip: total services (with active/inactive split), active count,
  average duration and the price range.
- Toolbar: search by name/description and an All / Active / Inactive filter,
  plus a visible "x of y" count.
- Responsive card grid (1 / 2 / 3 columns) with the calendar colour swatch,
  name, description, active badge, duration, price (LKR via `formatRupee`) and
  always-visible **Edit** / **Delete** actions (no hover-only controls, so touch
  devices can use them).
- Loading skeletons, an error state with retry, and separate empty states for an
  empty catalogue vs. filters that match nothing (with **Clear filters**).

## 2. Create and edit

`ServiceFormDialog` is keyed by `service.id + open`, so fields reset on every
reopen instead of via a state-syncing effect.

- Name, description (500-char counter), duration with 15/30/45/60/90 presets,
  price prefixed `Rs.`, calendar colour swatches plus a custom colour picker,
  display order and an Active switch.
- The same `AppointmentServiceSchema` used by the API validates the payload on
  the client, so duration (5–480), price bounds, name length and hex colours are
  caught before the request.
- Editing pre-fills every field from the selected catalogue row and PATCHes
  `/api/store/appointments/services/[id]`.
- Backend errors are shown inline; `SERVICE_NAME_EXISTS` is translated to
  "A service with this name already exists." instead of leaking the raw code.

## 3. Delete

A confirmation dialog names the service and warns that upcoming appointments
block removal. `DELETE /api/store/appointments/services/[id]` is still the
enforcement point (soft delete, `409 SERVICE_IN_USE` while future live
appointments reference the service); the dialog surfaces that API message as a
toast and stays open so the user can cancel.

## 4. Permissions

- Opening the page requires `appointment:view`.
- Add/edit/delete controls only render when the effective permissions include
  `appointment:services:manage`; the API re-checks this on every write.
- Read-only roles see the catalogue and summary without action buttons.

## 5. Pure helpers

`src/lib/appointments/service-catalog.ts` keeps the screen's logic testable:

- `toServicePrice` — normalises Prisma `Decimal` (serialised as a string) to a
  number.
- `filterAppointmentServices` — case-insensitive name/description search plus
  active/inactive filtering.
- `summarizeAppointmentServices` — totals, active count, rounded average
  duration, lowest/highest price.

## Tests

- `src/lib/appointments/__tests__/service-catalog.test.ts` — price
  normalisation, search/status combinations and summary maths.
- `tests/46_appointment_services_ui.spec.ts` — Playwright: the page renders the
  header and summary, a service is created, the edit dialog is pre-filled and
  saves, and delete confirmation removes the card. The spec cleans up through
  the API.

## Files

- `src/app/(store)/appointments/services/AppointmentsServicesPageClient.tsx`
- `src/components/appointments/services/ServiceList.tsx`
- `src/components/appointments/services/ServiceCard.tsx`
- `src/components/appointments/services/ServiceFormDialog.tsx`
- `src/lib/appointments/service-catalog.ts`
