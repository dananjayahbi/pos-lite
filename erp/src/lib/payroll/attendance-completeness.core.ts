/**
 * Attendance completeness for payroll (ARGUS #376).
 *
 * Payroll derives no-pay days from the shared attendance calendar
 * (ARGUS #348): a scheduled working day with no punch becomes ABSENT, not a
 * paid day. That rule is only as good as the attendance data behind it - a
 * month with no punches at all silently turns every scheduled day into an
 * inferred absence (or, when the person has no scheduled days in the period,
 * into no deduction at all).
 *
 * These helpers make that state explicit so the preview and the generate
 * action can warn and ask for confirmation instead of treating it as normal.
 * They are pure and shared by the API and the Run Payroll page.
 */

export type AttendanceCompletenessStatus =
  | 'COMPLETE'
  | 'PARTIAL'
  | 'NO_DATA'
  | 'NOT_SCHEDULED';

export interface AttendanceCompletenessInput {
  /** Scheduled working days in the period (past/today, excluding off/holiday/future). */
  expectedWorkingDays: number;
  /** Days with a punch or an explicit leave override. */
  recordedDays: number;
}

export interface AttendanceCompleteness {
  status: AttendanceCompletenessStatus;
  expectedWorkingDays: number;
  recordedDays: number;
  /** Working days with no attendance record. Never negative. */
  missingDays: number;
  label: string;
}

function wholeDays(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

export function assessAttendanceCompleteness(
  input: AttendanceCompletenessInput,
): AttendanceCompleteness {
  const expectedWorkingDays = wholeDays(input.expectedWorkingDays);
  const recordedDays = Math.min(wholeDays(input.recordedDays), expectedWorkingDays);
  const missingDays = Math.max(0, expectedWorkingDays - recordedDays);

  let status: AttendanceCompletenessStatus;
  let label: string;

  if (expectedWorkingDays === 0) {
    status = 'NOT_SCHEDULED';
    label = 'No scheduled working days in this period';
  } else if (recordedDays === 0) {
    status = 'NO_DATA';
    label = `No attendance recorded for ${expectedWorkingDays} working days`;
  } else if (missingDays > 0) {
    status = 'PARTIAL';
    label = `${missingDays} of ${expectedWorkingDays} working days have no attendance record`;
  } else {
    status = 'COMPLETE';
    label = 'Attendance complete';
  }

  return { status, expectedWorkingDays, recordedDays, missingDays, label };
}

export interface AttendanceCompletenessRow {
  userId: string;
  staffName: string;
  /** Net pay for the period; used to explain a not-scheduled full payment. */
  netSalary: number | string;
  completeness: AttendanceCompleteness;
}

export interface AttendanceCompletenessStaff {
  userId: string;
  staffName: string;
}

export interface AttendanceCompletenessSummary {
  /** Staff with scheduled working days and zero attendance records. */
  staffWithNoData: AttendanceCompletenessStaff[];
  /** Staff with some, but not all, working days recorded. */
  staffWithPartial: AttendanceCompletenessStaff[];
  /** Staff with no scheduled days (e.g. hired after the period) but a run row. */
  staffNotScheduled: AttendanceCompletenessStaff[];
  /** Total unrecorded working days across all staff. */
  missingDays: number;
  /** True when the operator must acknowledge the state before generating. */
  requiresConfirmation: boolean;
  message: string | null;
}

function ref(row: AttendanceCompletenessRow): AttendanceCompletenessStaff {
  return { userId: row.userId, staffName: row.staffName };
}

function names(staff: AttendanceCompletenessStaff[], limit = 3): string {
  const values = staff.map((member) => member.staffName);
  if (values.length <= limit) return values.join(', ');
  return `${values.slice(0, limit).join(', ')} and ${values.length - limit} more`;
}

function netValue(value: number | string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function summarizeAttendanceCompleteness(
  rows: AttendanceCompletenessRow[],
): AttendanceCompletenessSummary {
  const staffWithNoData = rows
    .filter((row) => row.completeness.status === 'NO_DATA')
    .map(ref);
  const staffWithPartial = rows
    .filter((row) => row.completeness.status === 'PARTIAL')
    .map(ref);
  const staffNotScheduled = rows
    .filter((row) => row.completeness.status === 'NOT_SCHEDULED')
    .map(ref);
  const missingDays = rows.reduce(
    (total, row) => total + row.completeness.missingDays,
    0,
  );

  const messages: string[] = [];
  if (staffWithNoData.length > 0) {
    messages.push(
      `No attendance is recorded for ${staffWithNoData.length} ${
        staffWithNoData.length === 1 ? 'employee' : 'employees'
      } (${names(staffWithNoData)}). Every scheduled working day without a punch is treated as absent and deducted as no-pay.`,
    );
  }
  if (staffWithPartial.length > 0) {
    messages.push(
      `Attendance is incomplete for ${staffWithPartial.length} ${
        staffWithPartial.length === 1 ? 'employee' : 'employees'
      } (${names(staffWithPartial)}): ${missingDays} working ${
        missingDays === 1 ? 'day has' : 'days have'
      } no record and are treated as absent.`,
    );
  }
  if (staffNotScheduled.length > 0) {
    const paid = rows.filter(
      (row) =>
        row.completeness.status === 'NOT_SCHEDULED' && netValue(row.netSalary) > 0,
    );
    messages.push(
      `${staffNotScheduled.length} ${
        staffNotScheduled.length === 1 ? 'employee has' : 'employees have'
      } no scheduled working days in this period (${names(staffNotScheduled)}), so no attendance deduction is possible${
        paid.length > 0 ? '; their salary is paid in full' : ''
      }. Check the employment dates if that is unexpected.`,
    );
  }

  return {
    staffWithNoData,
    staffWithPartial,
    staffNotScheduled,
    missingDays,
    requiresConfirmation:
      staffWithNoData.length > 0 || staffNotScheduled.length > 0,
    message: messages.length > 0 ? messages.join(' ') : null,
  };
}
