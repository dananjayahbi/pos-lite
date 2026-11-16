# Appointments page gutters

UI issue #16 — `/appointments`, `/appointments/list`, `/appointments/services`
and `/appointments/settings` rendered their content flush against the sidebar
and the right browser edge. The tab bar started at the sidebar border, tables
and cards ran under the scrollbar, and the calendar view switcher's last button
was clipped.

## Cause

`StoreLayoutClient` gives `<main>` the page surface but no padding — each page
owns its own gutters (the reports layout uses `p-4 md:p-6`, for example). The
shared `AppointmentsLayout` only applied `space-y-4`, so every appointment route
inherited zero horizontal and vertical padding.

## Fix

`AppointmentsLayout` now wraps all four routes in:

```tsx
<div data-testid="appointments-page" className="space-y-4 p-4 md:p-6">
```

- 16 px gutters on small screens, 24 px from the `md` breakpoint up — matching
  the reports pages.
- The gutters apply once for the whole section, so the tab bar, calendar grid,
  list table, service cards and settings forms all line up on the same edges.
- The `data-testid` gives the margin regression test a stable measurement hook.

## Verification

`tests/48_appointments_margins.spec.ts` logs in as the owner and visits all four
routes, asserting for each:

- computed left/right padding ≥ 16 px;
- the tab bar starts at least one gutter inside `#main-content`;
- direct page children stop at least one gutter before the main's right edge;
- `document.documentElement.scrollWidth` does not exceed the viewport (no
  horizontal overflow / clipped controls).

## Files

- `src/components/appointments/AppointmentsLayout.tsx`
- `tests/48_appointments_margins.spec.ts`
