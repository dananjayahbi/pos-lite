import { prisma } from '@/lib/prisma';
import type { AttendanceStatus } from '@/generated/prisma/client';
import { ApiError } from '@/lib/api/errors';
import { AUDIT_ACTIONS, createAuditLog } from '@/lib/services/audit.service';

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
  status: AttendanceStatus;
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
 * selected date, derived/overridden status, and OT over the 8-hour standard.
 */
export async function getDailyAttendance(
  tenantId: string,
  dateValue?: string | null,
): Promise<DailyAttendanceResult> {
  const dayStart = parseAttendanceDate(dateValue);
  const dayEnd = new Date(dayStart);
  dayEnd.setHours(23, 59, 59, 999);

  const [users, records, attendanceDays] = await Promise.all([
    prisma.user.findMany({
      where: {
        tenantId,
        deletedAt: null,
        isActive: true,
        role: { not: 'SUPER_ADMIN' },
      },
      select: { id: true, email: true, fullName: true, role: true },
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
    // Any punch (even one made seconds ago) means the person is present; the
    // derived absent status is only for a day with no punches and no override.
    const status: AttendanceStatus =
      attendance?.status ?? (userRecords.length > 0 ? 'PRESENT' : 'ABSENT');

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
    date: formatAttendanceDate(dayStart),
    standardWorkdayMinutes: STANDARD_WORKDAY_MINUTES,
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
  status: AttendanceStatus;
  notes: string | null;
  punches: number;
}

export interface StaffAttendanceReport {
  from: string;
  to: string;
  userId: string;
  rows: StaffAttendanceReportRow[];
  daysPresent: number;
  daysAbsent: number;
  daysLeave: number;
  daysHalfDay: number;
  daysHoliday: number;
  totalMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
}

/**
 * Date-ranged attendance report for one staff member. Used by the attendance
 * CSV download and the payslip PDF. Only days with a punch or an explicit
 * AttendanceDay override are emitted.
 */
export async function getStaffAttendanceReport(
  tenantId: string,
  userId: string,
  fromValue: string,
  toValue: string,
): Promise<StaffAttendanceReport> {
  const from = parseAttendanceDate(fromValue);
  const to = parseAttendanceDate(toValue);
  to.setHours(23, 59, 59, 999);

  const [records, attendanceDays] = await Promise.all([
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
  const dates = Array.from(
    new Set([...recordsByDate.keys(), ...overrideByDate.keys()]),
  ).sort();

  const now = new Date();
  const rows: StaffAttendanceReportRow[] = dates.map((dateKey) => {
    const dayRecords = recordsByDate.get(dateKey) ?? [];
    const override = overrideByDate.get(dateKey);
    const totals = computeAttendanceTotals(dayRecords, now);
    const status: AttendanceStatus =
      override?.status ?? (dayRecords.length > 0 ? 'PRESENT' : 'ABSENT');
    return {
      date: dateKey,
      clockInAt: totals.clockInAt?.toISOString() ?? null,
      clockOutAt: totals.clockOutAt?.toISOString() ?? null,
      totalMinutes: totals.totalMinutes,
      regularMinutes: totals.regularMinutes,
      overtimeMinutes: totals.overtimeMinutes,
      status,
      notes: override?.notes ?? null,
      punches: dayRecords.length,
    };
  });

  const sum = (predicate: (row: StaffAttendanceReportRow) => boolean) =>
    rows.filter(predicate).length;

  return {
    from: formatAttendanceDate(from),
    to: formatAttendanceDate(to),
    userId,
    rows,
    daysPresent: sum((row) => row.status === 'PRESENT'),
    daysAbsent: sum((row) => row.status === 'ABSENT'),
    daysLeave: sum((row) => row.status === 'LEAVE'),
    daysHalfDay: sum((row) => row.status === 'HALF_DAY'),
    daysHoliday: sum((row) => row.status === 'HOLIDAY'),
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

  if (Number.isNaN(nextClockedInAt.getTime())) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid clock-in time');
  }
  if (nextClockedOutAt && Number.isNaN(nextClockedOutAt.getTime())) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid clock-out time');
  }
  if (nextClockedOutAt && nextClockedOutAt.getTime() <= nextClockedInAt.getTime()) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Clock-out must be after clock-in');
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
