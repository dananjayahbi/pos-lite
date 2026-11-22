/**
 * Attendance presentation helpers (ARGUS #360).
 *
 * The timeclock history table used `toLocaleDateString('en-LK')`, which renders
 * `11/14/2026`, while the staff detail header renders `Nov 14, 2026`. Shift
 * references were an 8-character slice of the id, which is not meaningful to a
 * manager reviewing a day.
 */

export interface AttendanceShiftReference {
  id: string;
  openedAt: string;
  closedAt: string | null;
}

export function formatAttendanceDate(iso: string | Date | null | undefined): string {
  if (!iso) return '-';
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatAttendanceDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return '-';
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return `${formatAttendanceDate(date)}, ${date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

/**
 * Human-readable shift label: `Shift 14 Nov 2026, 09:00` plus the full id as a
 * tooltip. Falls back to the id when the opened time is unavailable.
 */
export function shiftReferenceLabel(
  shift: AttendanceShiftReference | null | undefined,
): { label: string; title: string } {
  if (!shift) return { label: '-', title: '' };
  const opened = new Date(shift.openedAt);
  if (Number.isNaN(opened.getTime())) {
    return { label: `Shift ${shift.id.slice(0, 8)}`, title: shift.id };
  }
  return { label: `Shift ${formatAttendanceDateTime(opened)}`, title: shift.id };
}
