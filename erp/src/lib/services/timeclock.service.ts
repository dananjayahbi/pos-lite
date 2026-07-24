import { prisma } from '@/lib/prisma';

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
