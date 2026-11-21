/**
 * ARGUS #134 — appointment summary cards must describe the operator's local
 * calendar day.
 *
 * The card asked the stats API for `${today}T00:00:00.000Z` .. `...23:59:59.999Z`,
 * i.e. the UTC day. In Sri Lanka (UTC+5:30) that dropped the first 5.5 hours of
 * today and included the last 5.5 hours of yesterday. This helper returns the
 * local day boundaries as ISO instants, matching the module's other date
 * filters (`appointmentDateFilters.core.ts`).
 */
export interface AppointmentDayRange {
  dateFrom: string;
  dateTo: string;
}

export function appointmentLocalDayRange(now: Date = new Date()): AppointmentDayRange {
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();
  const start = new Date(year, month, day, 0, 0, 0, 0);
  const end = new Date(year, month, day, 23, 59, 59, 999);
  return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
}
