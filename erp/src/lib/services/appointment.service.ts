import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma/client';
import { createAuditLog } from '@/lib/services/audit.service';
import type { CreateAppointmentInput, UpdateAppointmentInput, AppointmentFilters } from '@/lib/validators/appointment.validators';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function assertAppointmentBelongsToTenant(tenantId: string, appointmentId: string) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, tenantId },
  });
  if (!appointment) throw new Error('APPOINTMENT_NOT_FOUND');
  return appointment;
}

const appointmentInclude = {
  customer: true,
  service: true,
  staff: { select: { id: true, email: true, role: true } },
  sale: true,
} as const;

// ── List ─────────────────────────────────────────────────────────────────────

export async function getAppointments(tenantId: string, filters: Partial<AppointmentFilters> = {}) {
  const { status, staffId, serviceId, customerId, dateFrom, dateTo, page = 1, limit = 50 } = filters as AppointmentFilters;

  const where: Prisma.AppointmentWhereInput = {
    tenantId,
    ...(status && { status }),
    ...(staffId && { staffId }),
    ...(serviceId && { serviceId }),
    ...(customerId && { customerId }),
    ...(dateFrom || dateTo
      ? {
          startTime: {
            ...(dateFrom && { gte: new Date(dateFrom) }),
            ...(dateTo && { lte: new Date(dateTo) }),
          },
        }
      : {}),
  };

  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      include: appointmentInclude,
      orderBy: { startTime: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.appointment.count({ where }),
  ]);

  return { appointments, total, page, limit };
}

// ── Get by ID ────────────────────────────────────────────────────────────────

export async function getAppointmentById(tenantId: string, id: string) {
  const appointment = await prisma.appointment.findFirst({
    where: { id, tenantId },
    include: {
      customer: true,
      service: true,
      staff: { select: { id: true, email: true, role: true } },
      sale: true,
      reminders: { orderBy: { scheduledFor: 'asc' } },
      slot: true,
      createdBy: { select: { id: true, email: true, role: true } },
      cancelledBy: { select: { id: true, email: true } },
      checkedInBy: { select: { id: true, email: true } },
    },
  });

  if (!appointment) throw new Error('APPOINTMENT_NOT_FOUND');
  return appointment;
}

// ── Create ───────────────────────────────────────────────────────────────────

export async function createAppointment(
  tenantId: string,
  userId: string,
  input: CreateAppointmentInput,
) {
  const startTime = new Date(input.startTime);
  const endTime = new Date(input.endTime);
  const title = input.title || `${input.serviceId ? 'Appointment' : input.walkInName || 'Walk-in'}`;

  // Check for overlapping appointments for the same staff
  if (input.staffId) {
    const overlap = await prisma.appointment.findFirst({
      where: {
        tenantId,
        staffId: input.staffId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    });
    if (overlap) {
      throw new Error('STAFF_UNAVAILABLE');
    }
  }

  return prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.create({
      data: {
        tenantId,
        title,
        description: input.description ?? null,
        startTime,
        endTime,
        durationMins: input.durationMins,
        price: input.price,
        depositAmount: input.depositAmount ?? 0,
        notes: input.notes ?? null,
        customerNotes: input.customerNotes ?? null,
        walkInName: input.walkInName ?? null,
        walkInPhone: input.walkInPhone ?? null,
        customerId: input.customerId ?? null,
        serviceId: input.serviceId ?? null,
        staffId: input.staffId ?? null,
        createdById: userId,
        recurrenceType: input.recurrenceType ?? null,
        recurrenceEndDate: input.recurrenceEndDate ? new Date(input.recurrenceEndDate) : null,
      },
      include: appointmentInclude,
    });

    // If there's a slotId that should be linked, mark it as booked
    // (Slot linking happens via available slots selection in the UI)

    await createAuditLog({
      tenantId,
      actorId: userId,
      actorRole: 'OWNER',
      entityType: 'Appointment',
      entityId: appointment.id,
      action: 'CREATE',
    });

    return appointment;
  });
}

// ── Update ───────────────────────────────────────────────────────────────────

export async function updateAppointment(
  tenantId: string,
  id: string,
  input: UpdateAppointmentInput,
) {
  await assertAppointmentBelongsToTenant(tenantId, id);

  const data: Prisma.AppointmentUpdateInput = {};

  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.customerNotes !== undefined) data.customerNotes = input.customerNotes;
  if (input.walkInName !== undefined) data.walkInName = input.walkInName;
  if (input.walkInPhone !== undefined) data.walkInPhone = input.walkInPhone;
  if (input.customerId !== undefined) {
    data.customer = input.customerId ? { connect: { id: input.customerId } } : { disconnect: true };
  }
  if (input.serviceId !== undefined) {
    data.service = input.serviceId ? { connect: { id: input.serviceId } } : { disconnect: true };
  }
  if (input.staffId !== undefined) {
    data.staff = input.staffId ? { connect: { id: input.staffId } } : { disconnect: true };
  }
  if (input.price !== undefined) data.price = input.price;
  if (input.depositAmount !== undefined) data.depositAmount = input.depositAmount;
  if (input.durationMins !== undefined) data.durationMins = input.durationMins;
  if (input.status !== undefined) data.status = input.status;
  if (input.startTime !== undefined) data.startTime = new Date(input.startTime);
  if (input.endTime !== undefined) data.endTime = new Date(input.endTime);

  return prisma.appointment.update({
    where: { id },
    data,
    include: appointmentInclude,
  });
}

// ── Cancel ───────────────────────────────────────────────────────────────────

export async function cancelAppointment(
  tenantId: string,
  id: string,
  userId: string,
  reason?: string,
) {
  await assertAppointmentBelongsToTenant(tenantId, id);

  const appointment = await prisma.appointment.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelledById: userId,
      cancellationReason: reason ?? null,
    },
    include: appointmentInclude,
  });

  // Free the slot if linked
  if (appointment.slotId) {
    await prisma.appointmentSlot.update({
      where: { id: appointment.slotId },
      data: { isBooked: false, appointmentId: null },
    });
  }

  await createAuditLog({
    tenantId,
    actorId: userId,
    actorRole: 'OWNER',
    entityType: 'Appointment',
    entityId: id,
    action: 'CANCEL',
  });

  return appointment;
}

// ── Check In ─────────────────────────────────────────────────────────────────

export async function checkInAppointment(tenantId: string, id: string, userId: string) {
  await assertAppointmentBelongsToTenant(tenantId, id);

  return prisma.appointment.update({
    where: { id },
    data: {
      status: 'CHECKED_IN',
      checkedInAt: new Date(),
      checkedInById: userId,
    },
    include: appointmentInclude,
  });
}

// ── Mark In Progress ─────────────────────────────────────────────────────────

export async function markInProgress(tenantId: string, id: string) {
  await assertAppointmentBelongsToTenant(tenantId, id);

  return prisma.appointment.update({
    where: { id },
    data: { status: 'IN_PROGRESS' },
    include: appointmentInclude,
  });
}

// ── Complete ─────────────────────────────────────────────────────────────────

export async function completeAppointment(tenantId: string, id: string) {
  await assertAppointmentBelongsToTenant(tenantId, id);

  return prisma.appointment.update({
    where: { id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
    },
    include: appointmentInclude,
  });
}

// ── Mark No Show ─────────────────────────────────────────────────────────────

export async function markNoShow(tenantId: string, id: string) {
  await assertAppointmentBelongsToTenant(tenantId, id);

  const appointment = await prisma.appointment.update({
    where: { id },
    data: { status: 'NO_SHOW' },
    include: appointmentInclude,
  });

  // Free slot
  if (appointment.slotId) {
    await prisma.appointmentSlot.update({
      where: { id: appointment.slotId },
      data: { isBooked: false, appointmentId: null },
    });
  }

  return appointment;
}

// ── Confirm ──────────────────────────────────────────────────────────────────

export async function confirmAppointment(tenantId: string, id: string) {
  await assertAppointmentBelongsToTenant(tenantId, id);
  return prisma.appointment.update({
    where: { id },
    data: { status: 'CONFIRMED' },
    include: appointmentInclude,
  });
}

// ── Services (CRUD) ──────────────────────────────────────────────────────────

export async function getAppointmentServices(tenantId: string) {
  return prisma.appointmentService.findMany({
    where: { tenantId, deletedAt: null },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function getAppointmentServiceById(tenantId: string, id: string) {
  const service = await prisma.appointmentService.findFirst({
    where: { id, tenantId, deletedAt: null },
  });
  if (!service) throw new Error('SERVICE_NOT_FOUND');
  return service;
}

export async function createAppointmentService(
  tenantId: string,
  input: { name: string; description?: string | null | undefined; durationMins: number; price: number; color?: string | null | undefined; isActive?: boolean | undefined; sortOrder?: number | undefined },
) {
  const existing = await prisma.appointmentService.findFirst({
    where: { tenantId, name: input.name, deletedAt: null },
  });
  if (existing) throw new Error('SERVICE_NAME_EXISTS');

  return prisma.appointmentService.create({
    data: {
      tenantId,
      name: input.name,
      description: input.description ?? null,
      durationMins: input.durationMins,
      price: input.price,
      color: input.color ?? null,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
    },
  });
}

export async function updateAppointmentService(
  tenantId: string,
  id: string,
  input: { name?: string | undefined; description?: string | null | undefined; durationMins?: number | undefined; price?: number | undefined; color?: string | null | undefined; isActive?: boolean | undefined; sortOrder?: number | undefined },
) {
  const service = await prisma.appointmentService.findFirst({
    where: { id, tenantId, deletedAt: null },
  });
  if (!service) throw new Error('SERVICE_NOT_FOUND');

  if (input.name) {
    const existing = await prisma.appointmentService.findFirst({
      where: { tenantId, name: input.name, deletedAt: null, id: { not: id } },
    });
    if (existing) throw new Error('SERVICE_NAME_EXISTS');
  }

  return prisma.appointmentService.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.durationMins !== undefined && { durationMins: input.durationMins }),
      ...(input.price !== undefined && { price: input.price }),
      ...(input.color !== undefined && { color: input.color }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
      ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
    },
  });
}

export async function deleteAppointmentService(tenantId: string, id: string) {
  const service = await prisma.appointmentService.findFirst({
    where: { id, tenantId, deletedAt: null },
  });
  if (!service) throw new Error('SERVICE_NOT_FOUND');

  return prisma.appointmentService.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

// ── Stats ────────────────────────────────────────────────────────────────────

export async function getAppointmentStats(
  tenantId: string,
  dateFrom?: string,
  dateTo?: string,
) {
  const where: Prisma.AppointmentWhereInput = {
    tenantId,
    ...(dateFrom || dateTo
      ? {
          startTime: {
            ...(dateFrom && { gte: new Date(dateFrom) }),
            ...(dateTo && { lte: new Date(dateTo) }),
          },
        }
      : {}),
  };

  const [total, byStatusList, revenue] = await Promise.all([
    prisma.appointment.count({ where }),
    prisma.appointment.groupBy({
      by: ['status'],
      where,
      _count: true,
    }),
    prisma.appointment.aggregate({
      where: { ...where, status: 'COMPLETED' },
      _sum: { price: true },
    }),
  ]);

  const byStatus: Record<string, number> = {};
  for (const item of byStatusList) {
    byStatus[item.status] = item._count;
  }

  const noShowCount = byStatus['NO_SHOW'] || 0;
  const noShowRate = total > 0 ? (noShowCount / total) * 100 : 0;

  return {
    total,
    byStatus,
    noShowRate: Math.round(noShowRate * 100) / 100,
    revenue: Number(revenue._sum.price ?? 0),
  };
}

// ── Convert to Sale ──────────────────────────────────────────────────────────

export async function convertAppointmentToSale(
  tenantId: string,
  appointmentId: string,
  userId: string,
) {
  const appointment = await assertAppointmentBelongsToTenant(tenantId, appointmentId);

  if (appointment.status !== 'COMPLETED') {
    throw new Error('APPOINTMENT_NOT_COMPLETED');
  }

  if (appointment.saleId) {
    throw new Error('ALREADY_CONVERTED');
  }

  // Create the sale
  const sale = await prisma.sale.create({
    data: {
      tenantId,
      shiftId: '', // TODO: get active shift
      customerId: appointment.customerId,
      cashierId: userId,
      subtotal: appointment.price,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: appointment.price,
      status: 'COMPLETED',
      completedAt: new Date(),
      paymentMethod: 'CASH',
    },
  });

  // Link appointment to sale
  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { saleId: sale.id },
  });

  await createAuditLog({
    tenantId,
    actorId: userId,
    actorRole: 'OWNER',
    entityType: 'Appointment',
    entityId: appointmentId,
    action: 'CONVERT_TO_SALE',
  });

  return sale;
}
