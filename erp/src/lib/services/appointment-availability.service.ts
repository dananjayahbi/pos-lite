import { prisma } from '@/lib/prisma';
import type { StaffAvailabilityEntryInput, StaffTimeOffInput } from '@/lib/validators/appointment.validators';

// ── Staff Availability ───────────────────────────────────────────────────────

export async function getStaffAvailability(tenantId: string, staffId?: string) {
  const where = {
    tenantId,
    ...(staffId ? { staffId } : {}),
  };

  return prisma.staffAvailability.findMany({
    where,
    include: { staff: { select: { id: true, email: true, role: true } } },
    orderBy: [{ staffId: 'asc' }, { dayOfWeek: 'asc' }],
  });
}

export async function upsertStaffAvailability(
  tenantId: string,
  staffId: string,
  entries: StaffAvailabilityEntryInput[],
) {
  return prisma.$transaction(
    entries.map((entry) =>
      prisma.staffAvailability.upsert({
        where: {
          staffId_dayOfWeek: {
            staffId,
            dayOfWeek: entry.dayOfWeek,
          },
        },
        create: {
          tenantId,
          staffId,
          dayOfWeek: entry.dayOfWeek,
          startTime: entry.startTime,
          endTime: entry.endTime,
          isAvailable: entry.isAvailable ?? true,
          slotDurationMins: entry.slotDurationMins ?? 15,
        },
        update: {
          startTime: entry.startTime,
          endTime: entry.endTime,
          isAvailable: entry.isAvailable ?? true,
          slotDurationMins: entry.slotDurationMins ?? 15,
        },
      }),
    ),
  );
}

export async function deleteStaffAvailability(tenantId: string, id: string) {
  const record = await prisma.staffAvailability.findFirst({
    where: { id, tenantId },
  });
  if (!record) throw new Error('AVAILABILITY_NOT_FOUND');

  return prisma.staffAvailability.delete({ where: { id } });
}

// ── Staff Time Off ───────────────────────────────────────────────────────────

export async function getStaffTimeOff(
  tenantId: string,
  staffId?: string,
  dateFrom?: string,
  dateTo?: string,
) {
  const where = {
    tenantId,
    ...(staffId ? { staffId } : {}),
    ...(dateFrom || dateTo
      ? {
          date: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo) } : {}),
          },
        }
      : {}),
  };

  return prisma.staffTimeOff.findMany({
    where,
    include: {
      staff: { select: { id: true, email: true, role: true } },
      approvedBy: { select: { id: true, email: true } },
    },
    orderBy: { date: 'asc' },
  });
}

export async function requestTimeOff(tenantId: string, input: StaffTimeOffInput) {
  return prisma.staffTimeOff.create({
    data: {
      tenantId,
      staffId: input.staffId,
      date: new Date(input.date),
      startTime: input.startTime ? new Date(input.startTime) : null,
      endTime: input.endTime ? new Date(input.endTime) : null,
      reason: input.reason ?? null,
    },
  });
}

export async function approveTimeOff(tenantId: string, id: string, approvedById: string, isApproved: boolean) {
  const record = await prisma.staffTimeOff.findFirst({
    where: { id, tenantId },
  });
  if (!record) throw new Error('TIME_OFF_NOT_FOUND');

  return prisma.staffTimeOff.update({
    where: { id },
    data: { isApproved, approvedById },
  });
}

export async function deleteTimeOff(tenantId: string, id: string) {
  const record = await prisma.staffTimeOff.findFirst({
    where: { id, tenantId },
  });
  if (!record) throw new Error('TIME_OFF_NOT_FOUND');

  return prisma.staffTimeOff.delete({ where: { id } });
}

// ── Available Slots ──────────────────────────────────────────────────────────

export async function getAvailableSlots(
  tenantId: string,
  date: string,
  staffId?: string,
  serviceId?: string,
) {
  const targetDate = new Date(date);
  const dayStart = new Date(targetDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(targetDate);
  dayEnd.setHours(23, 59, 59, 999);

  const where = {
    tenantId,
    date: {
      gte: dayStart,
      lte: dayEnd,
    },
    isBooked: false,
    isBlocked: false,
    ...(staffId ? { staffId } : {}),
  };

  return prisma.appointmentSlot.findMany({
    where,
    include: { staff: { select: { id: true, email: true } } },
    orderBy: { startTime: 'asc' },
  });
}

// ── Generate Slots ───────────────────────────────────────────────────────────

export async function generateSlotsForRange(
  tenantId: string,
  startDate: string,
  endDate: string,
  staffIds?: string[],
) {
  // Get staff availability
  const availabilities = await prisma.staffAvailability.findMany({
    where: {
      tenantId,
      isAvailable: true,
      ...(staffIds?.length ? { staffId: { in: staffIds } } : {}),
    },
  });

  const staffSet = new Set(availabilities.map((a) => a.staffId));
  const start = new Date(startDate);
  const end = new Date(endDate);

  let created = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();

    for (const avail of availabilities) {
      if (avail.dayOfWeek !== dayOfWeek) continue;

      // Parse time strings
      const [startH = 0, startM = 0] = avail.startTime.split(':').map(Number);
      const [endH = 0, endM = 0] = avail.endTime.split(':').map(Number);

      const slotStart = new Date(current);
      slotStart.setHours(startH, startM, 0, 0);

      const slotEnd = new Date(current);
      slotEnd.setHours(endH, endM, 0, 0);

      // Generate slots at the configured duration
      let cursor = new Date(slotStart);
      while (cursor < slotEnd) {
        const next = new Date(cursor);
        next.setMinutes(next.getMinutes() + avail.slotDurationMins);

        if (next > slotEnd) break;

        // Check if slot already exists
        const existing = await prisma.appointmentSlot.findFirst({
          where: {
            staffId: avail.staffId,
            date: {
              gte: new Date(current.getFullYear(), current.getMonth(), current.getDate()),
              lt: new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1),
            },
            startTime: cursor,
            endTime: next,
          },
        });

        if (!existing) {
          // Check time off
          const hasTimeOff = await prisma.staffTimeOff.findFirst({
            where: {
              tenantId,
              staffId: avail.staffId,
              date: {
                gte: new Date(current.getFullYear(), current.getMonth(), current.getDate()),
                lt: new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1),
              },
              isApproved: true,
            },
          });

          if (!hasTimeOff) {
            await prisma.appointmentSlot.create({
              data: {
                tenantId,
                staffId: avail.staffId,
                date: new Date(current.getFullYear(), current.getMonth(), current.getDate()),
                startTime: cursor,
                endTime: next,
              },
            });
            created++;
          }
        }

        cursor = next;
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return { created };
}

// ── Get Available Staff ──────────────────────────────────────────────────────

export async function getAvailableStaffForTimeSlot(
  tenantId: string,
  date: string,
  startTime: string,
  durationMins: number,
) {
  const targetDate = new Date(date);
  const start = new Date(startTime);
  const end = new Date(start.getTime() + durationMins * 60000);

  const availableSlots = await prisma.appointmentSlot.findMany({
    where: {
      tenantId,
      date: {
        gte: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()),
        lt: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1),
      },
      startTime: { gte: start },
      endTime: { lte: end },
      isBooked: false,
      isBlocked: false,
    },
    include: { staff: { select: { id: true, email: true } } },
  });

  // Get unique staff from available slots
  const staffMap = new Map();
  for (const slot of availableSlots) {
    if (!staffMap.has(slot.staffId)) {
      staffMap.set(slot.staffId, slot.staff);
    }
  }

  return Array.from(staffMap.values());
}
