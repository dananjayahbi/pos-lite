import { prisma } from '@/lib/prisma';
import type { AttendanceStatus, Prisma } from '@/generated/prisma/client';
import { ApiError } from '@/lib/api/errors';
import { AUDIT_ACTIONS, createAuditLog } from '@/lib/services/audit.service';
import {
  buildAttendanceCalendarRows,
  deriveAttendanceStatus,
  isCalendarHoliday,
  isWorkingDay,
  normalizeAttendanceCalendar,
  parseAttendanceCalendar,
  todayAttendanceYmd,
  type AttendanceCalendarSettings,
  type AttendanceCalendarUpdate,
  type AttendanceDisplayStatus,
} from '@/lib/attendance/attendanceCalendar.core';
import {
  findOverlappingPunch,
  validatePunchTimes,
} from '@/lib/attendance/punchTimes.core';

/** A standard full day. Anything beyond this is overtime (OT). */
export const STANDARD_WORKDAY_MINUTES = 8 * 60;

export interface AttendanceClockRecord {
  id: string;
  clockedInAt: string;
  clockedOutAt: string | null;
  notes: string | null;
  durationMinutes: number;
  isOpen: boolean;
}

export interface DailyAttendanceRow {
  userId: string;
  email: string;
  fullName: string | null;
  role: string;
  status: AttendanceDisplayStatus;
  clockInAt: string | null;
  clockOutAt: string | null;
  totalMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  records: AttendanceClockRecord[];
  attendance: {
    id: string;
    status: AttendanceStatus;
    notes: string | null;
  } | null;
}

export interface DailyAttendanceResult {
  date: string;
  standardWorkdayMinutes: number;
  isWorkingDay: boolean;
  isHoliday: boolean;
  isFuture: boolean;
  calendar: AttendanceCalendarSettings;
  staff: DailyAttendanceRow[];
}

/** Calendar date (local midnight) from `YYYY-MM-DD`, or today when omitted. */
export function parseAttendanceDate(value?: string | null): Date {
  if (!value) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'date must be YYYY-MM-DD');
  }
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid date');
  }
  return parsed;
}

export function formatAttendanceDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Tenant attendance calendar from `settings.attendance`. */
export async function readAttendanceCalendar(tenantId: string): Promise<AttendanceCalendarSettings> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  return parseAttendanceCalendar(tenant?.settings);
}

/**
 * Persist the tenant attendance calendar (working weekdays + holiday dates) in
 * `Tenant.settings.attendance` — the shared source for the daily page, the
 * monthly report and the payslip. Audited with before/after values.
 */
export async function saveAttendanceCalendar(
  tenantId: string,
  input: AttendanceCalendarUpdate,
  actorId: string,
  actorRole: string,
): Promise<AttendanceCalendarSettings> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });

  const current =
    tenant?.settings && typeof tenant.settings === 'object' && !Array.isArray(tenant.settings)
      ? ({ ...(tenant.settings as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  const currentAttendance =
    current.attendance && typeof current.attendance === 'object' && !Array.isArray(current.attendance)
      ? ({ ...(current.attendance as Record<string, unknown>) } as Record<string, unknown>)
      : {};

  const previous = parseAttendanceCalendar(current);
  // Merge over the current values so a working-day-only save does not reset the
  // hour thresholds (and vice versa).
  const next = normalizeAttendanceCalendar({ ...previous, ...input });

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      settings: {
        ...current,
        attendance: { ...currentAttendance, ...next },
      } as unknown as Prisma.InputJsonValue,
    },
  });

  void createAuditLog({
    tenantId,
    actorId,
    actorRole,
    entityType: 'Tenant',
    entityId: tenantId,
    action: AUDIT_ACTIONS.ATTENDANCE_CALENDAR_UPDATED,
    before: previous as unknown as Prisma.InputJsonValue,
    after: next as unknown as Prisma.InputJsonValue,
  }).catch(() => {});

  return next;
}

/**
 * Sum one staff member's punches for the day and split the total into regular
 * minutes and overtime beyond the 8-hour standard workday.
 */
export function computeAttendanceTotals(
  records: { clockedInAt: Date; clockedOutAt: Date | null }[],
  now: Date = new Date(),
) {
  let totalMinutes = 0;
  let clockInAt: Date | null = null;
  let clockOutAt: Date | null = null;
  let hasOpen = false;

  for (const record of records) {
    if (!clockInAt || record.clockedInAt < clockInAt) clockInAt = record.clockedInAt;
    if (record.clockedOutAt) {
      if (!clockOutAt || record.clockedOutAt > clockOutAt) clockOutAt = record.clockedOutAt;
    } else {
      hasOpen = true;
    }
    const end = record.clockedOutAt ?? now;
    totalMinutes += Math.max(
      0,
      Math.round((end.getTime() - record.clockedInAt.getTime()) / 60_000),
    );
  }

  const overtimeMinutes = Math.max(0, totalMinutes - STANDARD_WORKDAY_MINUTES);
  return {
    totalMinutes,
    regularMinutes: totalMinutes - overtimeMinutes,
    overtimeMinutes,
    clockInAt,
    clockOutAt: hasOpen ? null : clockOutAt,
    hasOpen,
  };
}

/** Lightweight current-user status for the global header clock widget. */
export async function getMyTimeClockStatus(tenantId: string, userId: string) {
  const [user, openRecord] = await Promise.all([
    prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { clockedInAt: true },
    }),
    prisma.timeClock.findFirst({
      where: { tenantId, userId, clockedOutAt: null },
      orderBy: { clockedInAt: 'desc' },
      select: { id: true, clockedInAt: true },
    }),
  ]);

  const clockedInAt = user?.clockedInAt ?? openRecord?.clockedInAt ?? null;
  return {
    clockedInAt: clockedInAt?.toISOString() ?? null,
    openRecordId: openRecord?.id ?? null,
  };
}

export async function clockIn(tenantId: string, userId: string, shiftId?: string | undefined) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { clockedInAt: true },
    });

    if (user?.clockedInAt) {
      throw new Error('User is already clocked in');
    }

    const now = new Date();

    const timeClock = await tx.timeClock.create({
      data: {
        tenantId,
        userId,
        clockedInAt: now,
        ...(shiftId !== undefined && { shiftId }),
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: { clockedInAt: now },
    });

    return timeClock;
  });
}

export async function clockOut(tenantId: string, userId: string, notes?: string | undefined) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { clockedInAt: true },
    });

    if (!user?.clockedInAt) {
      throw new Error('User is not clocked in');
    }

    const now = new Date();

    const openEntry = await tx.timeClock.findFirst({
      where: { tenantId, userId, clockedOutAt: null },
      orderBy: { clockedInAt: 'desc' },
    });

    if (!openEntry) {
      throw new Error('No open time clock entry found');
    }

    const timeClock = await tx.timeClock.update({
      where: { id: openEntry.id },
      data: {
        clockedOutAt: now,
        ...(notes !== undefined && { notes }),
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: { clockedInAt: null },
    });

    const durationMs = now.getTime() - openEntry.clockedInAt.getTime();
    const durationMinutes = Math.round(durationMs / 60000);

    return { ...timeClock, durationMinutes };
  });
}

export async function getTimeClockHistory(
  tenantId: string,
  userId: string,
  page: number,
  pageSize: number,
) {
  const [records, total] = await Promise.all([
    prisma.timeClock.findMany({
      where: { tenantId, userId },
      orderBy: { clockedInAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        shift: { select: { id: true, openedAt: true, closedAt: true } },
      },
    }),
    prisma.timeClock.count({ where: { tenantId, userId } }),
  ]);

  const data = records.map((r: typeof records[number]) => {
    const durationMinutes = r.clockedOutAt
      ? Math.round((r.clockedOutAt.getTime() - r.clockedInAt.getTime()) / 60000)
      : null;
    return { ...r, durationMinutes };
  });

  return { records: data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getTimeClockSummary(tenantId: string, userId: string) {
  const now = new Date();

  // Start of current week (Monday)
  const weekStart = new Date(now);
  const day = weekStart.getDay();
  const diff = day === 0 ? 6 : day - 1;
  weekStart.setDate(weekStart.getDate() - diff);
  weekStart.setHours(0, 0, 0, 0);

  // Start of current month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [weekRecords, monthRecords] = await Promise.all([
    prisma.timeClock.findMany({
      where: { tenantId, userId, clockedInAt: { gte: weekStart } },
      select: { clockedInAt: true, clockedOutAt: true },
    }),
    prisma.timeClock.findMany({
      where: { tenantId, userId, clockedInAt: { gte: monthStart } },
      select: { clockedInAt: true, clockedOutAt: true },
    }),
  ]);

  function sumHours(records: { clockedInAt: Date; clockedOutAt: Date | null }[]): number {
    return records.reduce((total, r) => {
      const end = r.clockedOutAt ?? now;
      return total + (end.getTime() - r.clockedInAt.getTime()) / 3600000;
    }, 0);
  }

  return {
    hoursThisWeek: Math.round(sumHours(weekRecords) * 100) / 100,
    hoursThisMonth: Math.round(sumHours(monthRecords) * 100) / 100,
  };
}

/**
 * All-staff daily attendance: every active staff member, their punches for the
 * selected date, the shared calendar-derived status and OT over the 8-hour
 * standard.
 *
 * ARGUS #348: weekends/holidays are never ABSENT, future days are SCHEDULED and
 * explicit AttendanceDay overrides win — the same rule the monthly report uses.
 */
export async function getDailyAttendance(
  tenantId: string,
  dateValue?: string | null,
  options: { calendar?: AttendanceCalendarSettings } = {},
): Promise<DailyAttendanceResult> {
  const dayStart = parseAttendanceDate(dateValue);
  const dayEnd = new Date(dayStart);
  dayEnd.setHours(23, 59, 59, 999);
  const dateKey = formatAttendanceDate(dayStart);
  const today = todayAttendanceYmd();
  const calendar = options.calendar ?? (await readAttendanceCalendar(tenantId));

  const [users, records, attendanceDays] = await Promise.all([
    prisma.user.findMany({
      where: {
        tenantId,
        deletedAt: null,
        isActive: true,
        role: { not: 'SUPER_ADMIN' },
      },
      select: { id: true, email: true, fullName: true, role: true, createdAt: true },
      orderBy: { email: 'asc' },
    }),
    prisma.timeClock.findMany({
      where: {
        tenantId,
        clockedInAt: { gte: dayStart, lte: dayEnd },
      },
      orderBy: { clockedInAt: 'asc' },
    }),
    prisma.attendanceDay.findMany({
      where: {
        tenantId,
        date: { gte: dayStart, lte: dayEnd },
      },
      select: { id: true, userId: true, status: true, notes: true },
    }),
  ]);

  const recordsByUser = new Map<string, typeof records>();
  for (const record of records) {
    const list = recordsByUser.get(record.userId) ?? [];
    list.push(record);
    recordsByUser.set(record.userId, list);
  }

  const attendanceByUser = new Map(attendanceDays.map((row) => [row.userId, row]));
  const now = new Date();

  const staff: DailyAttendanceRow[] = users.map((user) => {
    const userRecords = recordsByUser.get(user.id) ?? [];
    const totals = computeAttendanceTotals(userRecords, now);
    const attendance = attendanceByUser.get(user.id) ?? null;
    const status = deriveAttendanceStatus({
      date: dateKey,
      today,
      hasPunches: userRecords.length > 0,
      workedMinutes: totals.totalMinutes,
      override: attendance?.status ?? null,
      calendar,
      employedFrom: formatAttendanceDate(user.createdAt),
    });

    return {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status,
      clockInAt: totals.clockInAt?.toISOString() ?? null,
      clockOutAt: totals.clockOutAt?.toISOString() ?? null,
      totalMinutes: totals.totalMinutes,
      regularMinutes: totals.regularMinutes,
      overtimeMinutes: totals.overtimeMinutes,
      records: userRecords.map((record) => {
        const end = record.clockedOutAt ?? now;
        return {
          id: record.id,
          clockedInAt: record.clockedInAt.toISOString(),
          clockedOutAt: record.clockedOutAt?.toISOString() ?? null,
          notes: record.notes,
          durationMinutes: Math.max(
            0,
            Math.round((end.getTime() - record.clockedInAt.getTime()) / 60_000),
          ),
          isOpen: record.clockedOutAt === null,
        };
      }),
      attendance: attendance
        ? { id: attendance.id, status: attendance.status, notes: attendance.notes }
        : null,
    };
  });

  return {
    date: dateKey,
    standardWorkdayMinutes: STANDARD_WORKDAY_MINUTES,
    isWorkingDay: isWorkingDay(dateKey, calendar),
    isHoliday: isCalendarHoliday(dateKey, calendar),
    isFuture: dateKey > today,
    calendar,
    staff,
  };
}

export interface StaffAttendanceReportRow {
  date: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  totalMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  status: AttendanceDisplayStatus;
  notes: string | null;
  punches: number;
}

export interface StaffAttendanceReport {
  from: string;
  to: string;
  userId: string;
  rows: StaffAttendanceReportRow[];
  daysPresent: number;
  /** Real absences + insufficient-hours days (payroll no-pay days). */
  daysAbsent: number;
  /** Subset of `daysAbsent`: punched but below the half-day threshold. */
  daysInsufficient: number;
  daysLeave: number;
  daysHalfDay: number;
  daysHoliday: number;
  /** Weekend / not-employed days (never counted as absent). */
  daysOff: number;
  totalMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
}

/**
 * Date-ranged attendance report for one staff member. Used by the attendance
 * CSV download, the payslip and the payroll preview.
 *
 * ARGUS #348: the report now walks the shared calendar (working days, weekends,
 * configured holidays, employment start) instead of emitting only days with a
 * punch/override, so its absent count matches the daily all-staff view.
 */
export async function getStaffAttendanceReport(
  tenantId: string,
  userId: string,
  fromValue: string,
  toValue: string,
  options: { calendar?: AttendanceCalendarSettings } = {},
): Promise<StaffAttendanceReport> {
  const from = parseAttendanceDate(fromValue);
  const to = parseAttendanceDate(toValue);
  to.setHours(23, 59, 59, 999);

  const calendar = options.calendar ?? (await readAttendanceCalendar(tenantId));

  const [records, attendanceDays, user] = await Promise.all([
    prisma.timeClock.findMany({
      where: {
        tenantId,
        userId,
        clockedInAt: { gte: from, lte: to },
      },
      orderBy: { clockedInAt: 'asc' },
    }),
    prisma.attendanceDay.findMany({
      where: {
        tenantId,
        userId,
        date: { gte: from, lte: to },
      },
    }),
    prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { createdAt: true },
    }),
  ]);

  const recordsByDate = new Map<string, typeof records>();
  for (const record of records) {
    const key = formatAttendanceDate(record.clockedInAt);
    const list = recordsByDate.get(key) ?? [];
    list.push(record);
    recordsByDate.set(key, list);
  }

  const overrideByDate = new Map(
    attendanceDays.map((row) => [formatAttendanceDate(row.date), row]),
  );

  const now = new Date();
  // Worked minutes per date drive the Present/Half Day/Insufficient grading.
  const workedMinutesByDate = new Map<string, number>();
  for (const [dateKey, dayRecords] of recordsByDate) {
    workedMinutesByDate.set(dateKey, computeAttendanceTotals(dayRecords, now).totalMinutes);
  }

  const calendarRows = buildAttendanceCalendarRows({
    from: formatAttendanceDate(from),
    to: formatAttendanceDate(to),
    today: todayAttendanceYmd(),
    calendar,
    punchDates: new Set(recordsByDate.keys()),
    workedMinutesByDate,
    overrides: new Map(
      attendanceDays.map((row) => [formatAttendanceDate(row.date), row.status]),
    ),
    employedFrom: user ? formatAttendanceDate(user.createdAt) : null,
  });

  const rows: StaffAttendanceReportRow[] = calendarRows.rows.map((calendarRow) => {
    const dayRecords = recordsByDate.get(calendarRow.date) ?? [];
    const override = overrideByDate.get(calendarRow.date);
    const totals = computeAttendanceTotals(dayRecords, now);
    return {
      date: calendarRow.date,
      clockInAt: totals.clockInAt?.toISOString() ?? null,
      clockOutAt: totals.clockOutAt?.toISOString() ?? null,
      totalMinutes: totals.totalMinutes,
      regularMinutes: totals.regularMinutes,
      overtimeMinutes: totals.overtimeMinutes,
      status: calendarRow.status,
      notes: override?.notes ?? null,
      punches: dayRecords.length,
    };
  });

  return {
    from: formatAttendanceDate(from),
    to: formatAttendanceDate(to),
    userId,
    rows,
    daysPresent: calendarRows.counts.present,
    // Payroll no-pay uses one derived absence rule: real absences plus days
    // worked below the half-day threshold (ARGUS #350).
    daysAbsent: calendarRows.counts.absent + calendarRows.counts.insufficient,
    daysInsufficient: calendarRows.counts.insufficient,
    daysLeave: calendarRows.counts.leave,
    daysHalfDay: calendarRows.counts.halfDay,
    daysHoliday: calendarRows.counts.holiday,
    daysOff: calendarRows.counts.off,
    totalMinutes: rows.reduce((total, row) => total + row.totalMinutes, 0),
    regularMinutes: rows.reduce((total, row) => total + row.regularMinutes, 0),
    overtimeMinutes: rows.reduce((total, row) => total + row.overtimeMinutes, 0),
  };
}

export interface UpdateTimeClockInput {
  clockedInAt?: string | undefined;
  clockedOutAt?: string | null | undefined;
  notes?: string | null | undefined;
}

/**
 * Adjust a punch (typically adding a missing clock-out). Keeps the user's
 * `clockedInAt` flag aligned when the edited record is the open one.
 */
export async function updateTimeClockRecord(
  tenantId: string,
  id: string,
  input: UpdateTimeClockInput,
  actorId: string,
  actorRole: string,
) {
  const existing = await prisma.timeClock.findFirst({ where: { id, tenantId } });
  if (!existing) {
    throw new ApiError(404, 'NOT_FOUND', 'Time clock record not found');
  }

  const nextClockedInAt =
    input.clockedInAt !== undefined ? new Date(input.clockedInAt) : existing.clockedInAt;
  const nextClockedOutAt =
    input.clockedOutAt === undefined
      ? existing.clockedOutAt
      : input.clockedOutAt === null || input.clockedOutAt === ''
        ? null
        : new Date(input.clockedOutAt);

  const now = new Date();
  const validation = validatePunchTimes(
    { clockedInAt: nextClockedInAt, clockedOutAt: nextClockedOutAt },
    now,
  );
  if (validation) {
    throw new ApiError(400, 'VALIDATION_ERROR', validation.message);
  }

  // ARGUS #349: edits must not create an overlapping punch either.
  const dayStart = new Date(nextClockedInAt);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setHours(23, 59, 59, 999);
  const otherPunches = await prisma.timeClock.findMany({
    where: {
      tenantId,
      userId: existing.userId,
      id: { not: id },
      OR: [
        { clockedInAt: { gte: dayStart, lte: dayEnd } },
        { clockedOutAt: null },
      ],
    },
    select: { id: true, clockedInAt: true, clockedOutAt: true },
  });
  const overlap = findOverlappingPunch(
    { clockedInAt: nextClockedInAt, clockedOutAt: nextClockedOutAt },
    otherPunches,
    now,
  );
  if (overlap) {
    throw new ApiError(
      409,
      'PUNCH_OVERLAP',
      'This time overlaps another punch for the same staff member',
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const record = await tx.timeClock.update({
      where: { id },
      data: {
        clockedInAt: nextClockedInAt,
        clockedOutAt: nextClockedOutAt,
        ...(input.notes !== undefined && { notes: input.notes }),
      },
    });

    // Only the currently-open punch drives the user's "clocked in" flag.
    if (existing.clockedOutAt === null) {
      if (nextClockedOutAt) {
        await tx.user.updateMany({
          where: { id: existing.userId, tenantId, clockedInAt: { not: null } },
          data: { clockedInAt: null },
        });
      } else {
        await tx.user.updateMany({
          where: { id: existing.userId, tenantId },
          data: { clockedInAt: nextClockedInAt },
        });
      }
    }

    return record;
  });

  void createAuditLog({
    tenantId,
    actorId,
    actorRole,
    entityType: 'TimeClock',
    entityId: id,
    action: AUDIT_ACTIONS.ATTENDANCE_ADJUSTED,
    before: {
      clockedInAt: existing.clockedInAt.toISOString(),
      clockedOutAt: existing.clockedOutAt?.toISOString() ?? null,
      notes: existing.notes,
    },
    after: {
      clockedInAt: updated.clockedInAt.toISOString(),
      clockedOutAt: updated.clockedOutAt?.toISOString() ?? null,
      notes: updated.notes,
    },
  }).catch(() => {});

  const end = updated.clockedOutAt ?? new Date();
  return {
    ...updated,
    durationMinutes: Math.max(
      0,
      Math.round((end.getTime() - updated.clockedInAt.getTime()) / 60_000),
    ),
  };
}

export interface CreateTimeClockInput {
  userId: string;
  clockedInAt: string;
  clockedOutAt?: string | null | undefined;
  /** Reason for the manual entry (becomes the punch note + audit detail). */
  notes?: string | null | undefined;
}

/**
 * Add a missing clock punch for a staff member (ARGUS #349).
 *
 * Manual entries obey the live clock rules: clock-out after clock-in, no future
 * times, no overlap with another punch, and an open punch only for today. The
 * entry is audited with the actor and the reason.
 */
export async function createTimeClockRecord(
  tenantId: string,
  input: CreateTimeClockInput,
  actorId: string,
  actorRole: string,
) {
  const user = await prisma.user.findFirst({
    where: { id: input.userId, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!user) {
    throw new ApiError(404, 'NOT_FOUND', 'Staff member not found');
  }

  const clockedInAt = new Date(input.clockedInAt);
  const clockedOutAt =
    input.clockedOutAt === null || input.clockedOutAt === undefined || input.clockedOutAt === ''
      ? null
      : new Date(input.clockedOutAt);
  const now = new Date();

  const validation = validatePunchTimes({ clockedInAt, clockedOutAt }, now);
  if (validation) {
    throw new ApiError(400, 'VALIDATION_ERROR', validation.message);
  }

  const dayStart = new Date(clockedInAt);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setHours(23, 59, 59, 999);

  // Same-day punches plus any other open punch (an open interval runs to now).
  const existing = await prisma.timeClock.findMany({
    where: {
      tenantId,
      userId: input.userId,
      OR: [
        { clockedInAt: { gte: dayStart, lte: dayEnd } },
        { clockedOutAt: null },
      ],
    },
    select: { id: true, clockedInAt: true, clockedOutAt: true },
  });

  const overlap = findOverlappingPunch({ clockedInAt, clockedOutAt }, existing, now);
  if (overlap) {
    throw new ApiError(
      409,
      'PUNCH_OVERLAP',
      'This time overlaps another punch for the same staff member',
    );
  }

  const notes = input.notes?.trim() ? input.notes.trim() : null;

  const record = await prisma.$transaction(async (tx) => {
    const created = await tx.timeClock.create({
      data: {
        tenantId,
        userId: user.id,
        clockedInAt,
        clockedOutAt,
        notes,
      },
    });

    // Only an open punch updates the "currently clocked in" flag.
    if (!clockedOutAt) {
      await tx.user.update({
        where: { id: user.id },
        data: { clockedInAt },
      });
    }

    return created;
  });

  void createAuditLog({
    tenantId,
    actorId,
    actorRole,
    entityType: 'TimeClock',
    entityId: record.id,
    action: AUDIT_ACTIONS.ATTENDANCE_PUNCH_ADDED,
    after: {
      userId: user.id,
      clockedInAt: record.clockedInAt.toISOString(),
      clockedOutAt: record.clockedOutAt?.toISOString() ?? null,
      notes,
    },
  }).catch(() => {});

  const end = record.clockedOutAt ?? now;
  return {
    ...record,
    durationMinutes: Math.max(
      0,
      Math.round((end.getTime() - record.clockedInAt.getTime()) / 60_000),
    ),
  };
}

export interface UpsertAttendanceDayInput {
  userId: string;
  date: string;
  status: AttendanceStatus;
  notes?: string | null | undefined;
}

/** Set Leave/Absent/Half Day/Holiday/Present for one staff member and day. */
export async function upsertAttendanceDay(
  tenantId: string,
  input: UpsertAttendanceDayInput,
  actorId: string,
  actorRole: string,
) {
  const user = await prisma.user.findFirst({
    where: { id: input.userId, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!user) {
    throw new ApiError(404, 'NOT_FOUND', 'Staff member not found');
  }

  const date = parseAttendanceDate(input.date);
  const record = await prisma.attendanceDay.upsert({
    where: {
      tenantId_userId_date: { tenantId, userId: input.userId, date },
    },
    create: {
      tenantId,
      userId: input.userId,
      date,
      status: input.status,
      notes: input.notes ?? null,
      recordedById: actorId,
    },
    update: {
      status: input.status,
      notes: input.notes ?? null,
      recordedById: actorId,
    },
  });

  void createAuditLog({
    tenantId,
    actorId,
    actorRole,
    entityType: 'AttendanceDay',
    entityId: record.id,
    action: AUDIT_ACTIONS.ATTENDANCE_STATUS_SET,
    after: {
      userId: input.userId,
      date: input.date,
      status: input.status,
      notes: input.notes ?? null,
    },
  }).catch(() => {});

  return record;
}
