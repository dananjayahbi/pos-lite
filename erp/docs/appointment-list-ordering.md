# Appointment list dates and ordering (ARGUS #129)

The list now shows the year and orders upcoming bookings before old/terminal
rows.

## Dates

`formatAppointmentListDate` (`src/lib/appointments/appointmentList.core.ts`):

- `Today, 10:00 AM`
- `Tomorrow, 2:30 PM`
- otherwise `Sep 7, 2029, 10:00 AM` — the year is always present for a dated
  row, so 2029/2034 fixtures are unambiguous.

## Ordering

`compareAppointmentsUpcomingFirst` defines the order:

1. active appointments (`SCHEDULED`, `CONFIRMED`, `CHECKED_IN`,
   `IN_PROGRESS`) with `startTime >= now`, nearest first;
2. everything else — past or terminal (`COMPLETED`, `CANCELLED`, `NO_SHOW`) —
   most recent first;
3. `id` ascending as a stable tiebreaker.

The service applies this order globally, not per page: it counts the upcoming
bucket and queries the upcoming and past/terminal buckets separately with
`skip`/`take` spanning the boundary. Page 1 therefore starts with the nearest
upcoming booking instead of the oldest cancelled QA row; pagination follows the
same order.

The list view also sorts the returned page with the same comparator as a
defensive check. Calendar views are unaffected because they group by hour/day
rather than relying on list order.

## Tests

`src/lib/appointments/__tests__/appointmentList.core.test.ts` covers years for
2029/2034, today/tomorrow labels, invalid dates, upcoming detection, nearest
first, upcoming-before-terminal, past/terminal recency and the id tiebreaker.
