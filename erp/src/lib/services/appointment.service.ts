import { prisma } from '@/lib/prisma';
import Decimal from 'decimal.js';
import type { Prisma, TaxRule } from '@/generated/prisma/client';
import { createAuditLog } from '@/lib/services/audit.service';
import { getCurrentShift } from '@/lib/services/shift.service';
import { scheduleReminders } from '@/lib/services/appointment-reminder.service';
import { lockForUpdate } from '@/lib/api/race-guard';
import { createPayment } from '@/lib/services/payment.service';
import { addToSpendTotal, issueCredit } from '@/lib/services/customer.service';
import { buildSaleAccountLegs, postSaleToAccounts } from '@/lib/services/saleAccounts';
import { extractTenantRates } from '@/lib/services/sale.service';
import { computeAppointmentSalePricing, resolveAppointmentSaleOwner } from '@/lib/appointments/appointmentSale.core';
import { createCommissionRecord } from '@/lib/services/commission.service';
import {
  appointmentCancellationBlockReason,
  appointmentDepositAmount,
  appointmentDepositDisposition,
} from '@/lib/appointments/appointmentCancellation.core';
import { summarizeAppointmentRevenue } from '@/lib/appointments/appointmentRevenue.core';
import {
  isAppointmentTransitionAllowedBySettings,
  resolveInitialAppointmentStatus,
} from '@/lib/appointments/appointmentSettings.core';
import { getAppointmentSettings } from '@/lib/services/appointment-settings.service';
import { APPOINTMENT_BACKDATE_GRACE_MINUTES } from '@/lib/constants/appointments';
import {
  APPOINTMENT_OVERDUE_STATUSES,
  appointmentOverdueCutoff,
} from '@/lib/appointments/appointmentOverdue.core';
import { appointmentAvailabilityIssue } from '@/lib/appointments/appointmentAvailability.core';
import { APPOINTMENT_OPEN_STATUSES } from '@/lib/appointments/appointmentList.core';
import {
  parseAppointmentDateEnd,
  parseAppointmentDateStart,
} from '@/lib/appointments/appointmentDateFilters.core';
import {
  appointmentActionBlockReason,
  type AppointmentLifecycleAction,
} from '@/lib/appointments/appointmentLifecycle.core';
import type {
  CreateAppointmentInput,
  UpdateAppointmentInput,
  AppointmentFilters,
} from '@/lib/validators/appointment.validators';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function assertAppointmentBelongsToTenant(tenantId: string, appointmentId: string) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, tenantId },
  });
  if (!appointment) throw new Error('APPOINTMENT_NOT_FOUND');
  return appointment;
}

/**
 * ARGUS #125: every action endpoint walks the same lifecycle map as the generic
 * PATCH. Without this, a direct POST could skip confirmation/check-in or
 * resurrect a terminal row.
 */
async function assertAppointmentActionAllowed(
  tenantId: string,
  appointmentId: string,
  action: AppointmentLifecycleAction,
) {
  const existing = await assertAppointmentBelongsToTenant(tenantId, appointmentId);
  const settings = await getAppointmentSettings(tenantId);
  const blockReason = appointmentActionBlockReason(existing.status, action, settings);
  if (blockReason) throw new Error(blockReason);
  return existing;
}

/**
 * M27-04 / OBS-79 backdate policy: a booking may be recorded up to
 * `APPOINTMENT_BACKDATE_GRACE_MINUTES` in the past (clinics legitimately record
 * a walk-in after the fact), beyond which the caller must hold
 * `appointment:settings:manage`. The public storefront booking path is always
 * enforced — it has no privileged actor.
 */
async function assertBackdateAllowed(
  startTime: Date,
  actorHasManageSettings: boolean,
): Promise<void> {
  const cutoff = new Date(Date.now() - APPOINTMENT_BACKDATE_GRACE_MINUTES * 60_000);
  if (startTime >= cutoff || actorHasManageSettings) return;
  throw new Error('BACKDATE_NOT_ALLOWED');
}

/**
 * ARGUS #127: a specific staff member can only be booked inside their
 * configured availability and outside approved time off / blocked slots.
 * The issue code is the API's typed 422 reason.
 */
async function assertStaffAvailability(
  tenantId: string,
  staffId: string,
  startTime: Date,
  endTime: Date,
): Promise<void> {
  const dayStart = new Date(startTime);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(startTime);
  dayEnd.setHours(23, 59, 59, 999);

  const [availability, timeOff, blockedSlots] = await Promise.all([
    prisma.staffAvailability.findMany({ where: { tenantId, staffId } }),
    prisma.staffTimeOff.findMany({
      where: {
        tenantId,
        staffId,
        isApproved: true,
        date: { gte: dayStart, lte: dayEnd },
      },
    }),
    prisma.appointmentSlot.findMany({
      where: {
        tenantId,
        staffId,
        isBlocked: true,
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    }),
  ]);

  const issue = appointmentAvailabilityIssue({
    startTime,
    endTime,
    availability,
    timeOff,
    blockedSlots,
  });
  if (issue) throw new Error(issue.code);
}

const appointmentInclude = {
  customer: true,
  service: true,
  staff: { select: { id: true, email: true, role: true } },
  sale: true,
} as const;

// ── List ─────────────────────────────────────────────────────────────────────

export async function getAppointments(tenantId: string, filters: Partial<AppointmentFilters> = {}) {
  const {
    status,
    staffId,
    serviceId,
    customerId,
    dateFrom,
    dateTo,
    page = 1,
    limit = 50,
  } = filters as AppointmentFilters;

  const startTimeFilter: { gte?: Date; lte?: Date } = {};
  if (dateFrom) startTimeFilter.gte = parseAppointmentDateStart(dateFrom);
  if (dateTo) startTimeFilter.lte = parseAppointmentDateEnd(dateTo);
  if (status === 'OVERDUE') {
    // ARGUS #126: derived filter — active rows whose start is past the grace
    // window. This only restricts the query; it never writes status.
    const cutoff = appointmentOverdueCutoff();
    if (!startTimeFilter.lte || startTimeFilter.lte > cutoff) {
      startTimeFilter.lte = cutoff;
    }
  }

  const where: Prisma.AppointmentWhereInput = {
    tenantId,
    ...(status === 'OVERDUE'
      ? { status: { in: [...APPOINTMENT_OVERDUE_STATUSES] } }
      : status
        ? { status }
        : {}),
    ...(staffId && { staffId }),
    ...(serviceId && { serviceId }),
    ...(customerId && { customerId }),
    ...(Object.keys(startTimeFilter).length > 0 ? { startTime: startTimeFilter } : {}),
  };

  // ARGUS #129: upcoming active rows first (nearest first), then past/terminal
  // rows (most recent first). Pagination is applied across that global order,
  // so cancelled QA rows cannot occupy page 1 ahead of upcoming bookings.
  const now = new Date();
  const upcomingWhere: Prisma.AppointmentWhereInput = {
    AND: [
      where,
      { status: { in: [...APPOINTMENT_OPEN_STATUSES] } },
      { startTime: { gte: now } },
    ],
  };
  const pastWhere: Prisma.AppointmentWhereInput = {
    AND: [
      where,
      {
        OR: [
          { status: { notIn: [...APPOINTMENT_OPEN_STATUSES] } },
          { startTime: { lt: now } },
        ],
      },
    ],
  };

  const skip = (page - 1) * limit;
  const [total, upcomingCount] = await Promise.all([
    prisma.appointment.count({ where }),
    prisma.appointment.count({ where: upcomingWhere }),
  ]);

  let appointments;
  if (skip < upcomingCount) {
    const fromUpcoming = await prisma.appointment.findMany({
      where: upcomingWhere,
      include: appointmentInclude,
      orderBy: [{ startTime: 'asc' }, { id: 'asc' }],
      skip,
      take: limit,
    });
    const remaining = limit - fromUpcoming.length;
    const fromPast =
      remaining > 0
        ? await prisma.appointment.findMany({
            where: pastWhere,
            include: appointmentInclude,
            orderBy: [{ startTime: 'desc' }, { id: 'asc' }],
            take: remaining,
          })
        : [];
    appointments = [...fromUpcoming, ...fromPast];
  } else {
    appointments = await prisma.appointment.findMany({
      where: pastWhere,
      include: appointmentInclude,
      orderBy: [{ startTime: 'desc' }, { id: 'asc' }],
      skip: skip - upcomingCount,
      take: limit,
    });
  }

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
  actorRole = 'UNKNOWN',
  canManageSettings = false,
) {
  const startTime = new Date(input.startTime);
  const endTime = new Date(input.endTime);
  const title = input.title || `${input.serviceId ? 'Appointment' : input.walkInName || 'Walk-in'}`;

  // M27-04/OBS-79: reject far-past bookings unless the actor may manage settings.
  await assertBackdateAllowed(startTime, canManageSettings);

  // ARGUS #127: booking a specific staff member must respect their roster.
  if (input.staffId) {
    await assertStaffAvailability(tenantId, input.staffId, startTime, endTime);
  }

  // ARGUS #124: the tenant decides whether new bookings arrive already
  // confirmed; defaults keep the historical SCHEDULED behaviour.
  const settings = await getAppointmentSettings(tenantId);
  const initialStatus = resolveInitialAppointmentStatus(settings);

  // M27-06/BUG-92: the overlap check used to run OUTSIDE the transaction
  // (TOCTOU — 3 concurrent same-slot bookings all 201'd). It is now performed
  // inside the transaction after locking the staff member's row, so same-staff
  // writers serialize: the loser sees the committed row and 409s.
  //
  // The audit + reminder-scheduling side effects were previously inside this
  // transaction too, which pushed the interactive-transaction budget past
  // Prisma's default 5s under dev-server load (P2028 "cannot commit on an
  // expired transaction" → a spurious 500 on an otherwise legal booking). They
  // are post-commit now: only the lock + overlap probe + insert need atomicity.
  const appointment = await prisma.$transaction(
    async (tx) => {
      if (input.staffId) {
        await lockForUpdate(tx, 'users', '"id" = $1', [input.staffId]);
        const overlap = await tx.appointment.findFirst({
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

      return tx.appointment.create({
        data: {
          tenantId,
          title,
          description: input.description ?? null,
          startTime,
          endTime,
          durationMins: input.durationMins,
          price: input.price,
          depositAmount: input.depositAmount ?? 0,
          status: initialStatus,
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
    },
    { timeout: 15_000 },
  );

  await createAuditLog({
    tenantId,
    actorId: userId,
    actorRole,
    entityType: 'Appointment',
    entityId: appointment.id,
    action: 'CREATE',
  });

  // M27-08: schedule the 24h/2h reminder rows (the cron sends them). Non-fatal
  // — a reminder-scheduling failure must not lose the booking.
  try {
    await scheduleReminders({ appointmentId: appointment.id, tenantId });
  } catch (reminderError) {
    console.warn('Failed to schedule appointment reminders:', reminderError);
  }

  return appointment;
}

// ── Update ───────────────────────────────────────────────────────────────────

export async function updateAppointment(
  tenantId: string,
  id: string,
  input: UpdateAppointmentInput,
) {
  const existing = await assertAppointmentBelongsToTenant(tenantId, id);

  // ARGUS #127: re-validate the roster only when the schedule/staff actually
  // changes. Status/notes edits on an existing row (including legacy rows that
  // predate enforcement) must remain possible.
  const scheduleTouched =
    input.staffId !== undefined ||
    input.startTime !== undefined ||
    input.endTime !== undefined ||
    input.durationMins !== undefined;
  if (scheduleTouched) {
    const effectiveStaffId = input.staffId !== undefined ? input.staffId : existing.staffId;
    if (effectiveStaffId) {
      await assertStaffAvailability(
        tenantId,
        effectiveStaffId,
        input.startTime ? new Date(input.startTime) : existing.startTime,
        input.endTime ? new Date(input.endTime) : existing.endTime,
      );
    }
  }

  // M27-04/BUG-88: the PATCH path used to write any status the client sent
  // (SCHEDULED→COMPLETED skipping check-in, COMPLETED→CANCELLED erasing revenue).
  // Restrict to the legal lifecycle edges; terminal rows reject status edits.
  if (input.status !== undefined && input.status !== existing.status) {
    // ARGUS #124: the tenant's "require confirmation" toggle decides whether a
    // SCHEDULED booking may skip straight to check-in/completion. With the
    // default settings this is exactly the canonical lifecycle map.
    const settings = await getAppointmentSettings(tenantId);
    if (!isAppointmentTransitionAllowedBySettings(existing.status, input.status, settings)) {
      throw new Error('INVALID_STATUS_TRANSITION');
    }
    // ARGUS #120: cancellation carries bookkeeping the generic edit path cannot
    // provide (cancelledAt/By, deposit refund, cancellation audit). Faking the
    // status here would also skip the sale guard, so cancellation must go
    // through `cancelAppointment`.
    if (input.status === 'CANCELLED') {
      throw new Error('CANCELLATION_REQUIRES_CANCEL_ENDPOINT');
    }
  }

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
  actorRole = 'UNKNOWN',
) {
  const existing = await assertAppointmentBelongsToTenant(tenantId, id);

  // ARGUS #120: cancelling is a lifecycle transition, not a free-form write.
  // A converted appointment has a completed Sale — cancelling it would leave
  // paid revenue attached to a cancelled booking (ARGUS #119) — and terminal
  // rows must not be re-cancelled. Void the sale through its own flow instead.
  const blockReason = appointmentCancellationBlockReason(existing);
  if (blockReason) {
    throw new Error(blockReason);
  }

  // ARGUS #120: the deposit is money already collected at booking. An unpaid
  // deposit on a customer-linked booking is returned as store credit (balance +
  // credit-note ledger, same helper returns use); a walk-in has no ledger, so
  // the amount is recorded in the cancellation audit for manual follow-up.
  const depositDisposition = appointmentDepositDisposition(existing);
  const depositAmount = appointmentDepositAmount(existing);
  const depositRefunded =
    depositDisposition === 'REFUND_TO_STORE_CREDIT' && existing.customerId !== null;

  const appointment = await prisma.$transaction(async (tx) => {
    if (depositDisposition === 'REFUND_TO_STORE_CREDIT' && existing.customerId) {
      await issueCredit(
        tenantId,
        existing.customerId,
        new Decimal(depositAmount),
        `Deposit refund for cancelled appointment ${id.slice(0, 8).toUpperCase()}`,
        tx,
      );
    }

    const updated = await tx.appointment.update({
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
    if (updated.slotId) {
      await tx.appointmentSlot.update({
        where: { id: updated.slotId },
        data: { isBooked: false, appointmentId: null },
      });
    }

    return updated;
  }, { maxWait: 10_000, timeout: 30_000 });

  await createAuditLog({
    tenantId,
    actorId: userId,
    actorRole,
    entityType: 'Appointment',
    entityId: id,
    action: 'CANCEL',
    before: { status: existing.status },
    after: {
      status: 'CANCELLED',
      depositAmount,
      depositDisposition,
      depositRefunded,
    },
  });

  return appointment;
}

// ── Check In ─────────────────────────────────────────────────────────────────

export async function checkInAppointment(tenantId: string, id: string, userId: string) {
  await assertAppointmentActionAllowed(tenantId, id, 'check_in');

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
  await assertAppointmentActionAllowed(tenantId, id, 'start');

  return prisma.appointment.update({
    where: { id },
    data: { status: 'IN_PROGRESS' },
    include: appointmentInclude,
  });
}

// ── Complete ─────────────────────────────────────────────────────────────────

export async function completeAppointment(tenantId: string, id: string) {
  await assertAppointmentActionAllowed(tenantId, id, 'complete');

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
  await assertAppointmentActionAllowed(tenantId, id, 'no_show');

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
  await assertAppointmentActionAllowed(tenantId, id, 'confirm');

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
  input: {
    name: string;
    description?: string | null | undefined;
    durationMins: number;
    price: number;
    taxRule?: TaxRule | undefined;
    color?: string | null | undefined;
    isActive?: boolean | undefined;
    sortOrder?: number | undefined;
  },
) {
  const existing = await prisma.appointmentService.findFirst({
    // M27-05/BUG-90: `@@unique([tenantId, name])` spans soft-deleted rows, so
    // the pre-check must too — otherwise a recreate passes here and dies on
    // P2002. Names stay reserved while any row exists (Category/Brand policy).
    where: { tenantId, name: input.name },
  });
  if (existing) throw new Error('SERVICE_NAME_EXISTS');

  return prisma.appointmentService.create({
    data: {
      tenantId,
      name: input.name,
      description: input.description ?? null,
      durationMins: input.durationMins,
      price: input.price,
      taxRule: input.taxRule ?? 'STANDARD_VAT',
      color: input.color ?? null,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
    },
  });
}

export async function updateAppointmentService(
  tenantId: string,
  id: string,
  input: {
    name?: string | undefined;
    description?: string | null | undefined;
    durationMins?: number | undefined;
    price?: number | undefined;
    taxRule?: TaxRule | undefined;
    color?: string | null | undefined;
    isActive?: boolean | undefined;
    sortOrder?: number | undefined;
  },
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
      ...(input.taxRule !== undefined && { taxRule: input.taxRule }),
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

  // M27-05/BUG-90: block removing a service that future/active appointments
  // still reference (they would orphan onto a dead row). Historical
  // (completed/cancelled/past) references do not block — the row survives the
  // soft-delete for the audit trail.
  const upcoming = await prisma.appointment.count({
    where: {
      tenantId,
      serviceId: id,
      status: { in: ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN'] },
      startTime: { gte: new Date() },
    },
  });
  if (upcoming > 0) throw new Error('SERVICE_IN_USE');

  return prisma.appointmentService.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

// ── Stats ────────────────────────────────────────────────────────────────────

export async function getAppointmentStats(tenantId: string, dateFrom?: string, dateTo?: string) {
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

  // ARGUS #121: "revenue" used to sum the price of every COMPLETED appointment,
  // including visits nobody had paid for. It now counts money actually held:
  // the full price once the visit is marked paid, otherwise only the deposit
  // that was collected at booking. Cancelled bookings are excluded because
  // their deposit is returned as store credit on cancellation.
  const collectedWhere: Prisma.AppointmentWhereInput = { ...where, status: { not: 'CANCELLED' } };

  const [total, byStatusList, paidAgg, depositAgg, completedUnpaidAgg] = await Promise.all([
    prisma.appointment.count({ where }),
    prisma.appointment.groupBy({
      by: ['status'],
      where,
      _count: true,
    }),
    prisma.appointment.aggregate({
      where: { ...collectedWhere, isPaid: true },
      _sum: { price: true },
    }),
    prisma.appointment.aggregate({
      where: { ...collectedWhere, isPaid: false },
      _sum: { depositAmount: true },
    }),
    prisma.appointment.aggregate({
      where: { ...where, status: 'COMPLETED', isPaid: false },
      _count: true,
      _sum: { price: true, depositAmount: true },
    }),
  ]);

  const byStatus: Record<string, number> = {};
  for (const item of byStatusList) {
    byStatus[item.status] = item._count;
  }

  const noShowCount = byStatus['NO_SHOW'] || 0;
  const noShowRate = total > 0 ? (noShowCount / total) * 100 : 0;

  const paidRevenue = Number(paidAgg._sum.price ?? 0);
  const depositsHeld = Number(depositAgg._sum.depositAmount ?? 0);
  const completedUnpaid = completedUnpaidAgg._count;

  const revenueSummary = summarizeAppointmentRevenue({
    paidPrice: paidRevenue,
    unpaidDeposits: depositsHeld,
    completedUnpaidPrice: completedUnpaidAgg._sum.price ?? 0,
    completedUnpaidDeposits: completedUnpaidAgg._sum.depositAmount ?? 0,
  });

  return {
    total,
    byStatus,
    noShowRate: Math.round(noShowRate * 100) / 100,
    /** Money actually collected (paid visits at price, otherwise deposits). */
    revenue: revenueSummary.revenue,
    /** Completed visits with no payment recorded, and what they still owe. */
    completedUnpaidCount: completedUnpaid,
    outstandingBalance: revenueSummary.outstandingBalance,
    /** Deposits collected on bookings that are not settled as paid yet. */
    depositsHeld: revenueSummary.depositsHeld,
  };
}

// ── Convert to Sale ──────────────────────────────────────────────────────────

export async function convertAppointmentToSale(
  tenantId: string,
  appointmentId: string,
  userId: string,
  actorRole = 'UNKNOWN',
) {
  const appointment = await assertAppointmentBelongsToTenant(tenantId, appointmentId);

  if (appointment.status !== 'COMPLETED') {
    throw new Error('APPOINTMENT_NOT_COMPLETED');
  }

  if (appointment.saleId) {
    throw new Error('ALREADY_CONVERTED');
  }

  // Attribute the converted sale to the appointment's staff/doctor; if none is
  // set, fall back to the operator who clicked Convert (ARGUS #132).
  const attributedUserId = resolveAppointmentSaleOwner({
    staffId: appointment.staffId,
    operatorId: userId,
  });

  // M27-01/BUG-85: resolve the attributable user's OPEN shift (same lookup POS
  // checkout uses); when there is none we link the sale shift-lessly.
  const activeShift = await getCurrentShift(tenantId, attributedUserId);

  // Price the service like a sale: the tenant VAT rate applies to the
  // appointment price, so the persisted sale carries a tax amount and a line
  // item instead of a bare total (ARGUS #119).
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  const { vatRate, ssclRate } = extractTenantRates(tenant?.settings);
  // The service's tax rule decides VAT/SSCL/exempt; an explicit exempt service
  // is documented on the service rather than silently producing zero tax
  // (ARGUS #131).
  const serviceTaxRule = appointment.serviceId
    ? (
        await prisma.appointmentService.findFirst({
          where: { id: appointment.serviceId, tenantId },
          select: { taxRule: true },
        })
      )?.taxRule ?? 'STANDARD_VAT'
    : 'STANDARD_VAT';
  // The service price is the subtotal; the appointment's deposit is money
  // already collected at booking.
  const pricing = computeAppointmentSalePricing({
    price: appointment.price,
    vatRate,
    ssclRate,
    taxRule: serviceTaxRule,
    deposit: appointment.depositAmount,
  });
  const { subtotal, taxAmount: lineTax, totalAmount, depositApplied, balanceDue } = pricing;

  // The sale is dated at the appointment, not at conversion time.
  const saleDate = appointment.completedAt ?? appointment.startTime;

  const sale = await prisma.$transaction(async (tx) => {
    const created = await tx.sale.create({
      data: {
        tenant: { connect: { id: tenantId } },
        ...(activeShift ? { shift: { connect: { id: activeShift.id } } } : {}),
        ...(appointment.customerId
          ? { customer: { connect: { id: appointment.customerId } } }
          : {}),
        cashier: { connect: { id: attributedUserId } },
        subtotal: subtotal.toNumber(),
        discountAmount: 0,
        taxAmount: lineTax.toNumber(),
        totalAmount: totalAmount.toNumber(),
        deliveryCharge: 0,
        paymentMethod: 'CASH',
        status: 'COMPLETED',
        saleDate,
        completedAt: new Date(),
        lines: {
          create: [
            {
              // Service lines have no product variant (and no stock movement).
              productNameSnapshot: appointment.title || 'Appointment',
              variantDescriptionSnapshot: 'Service',
              sku: `SVC-${appointment.id.slice(-6).toUpperCase()}`,
              unitPrice: subtotal.toNumber(),
              costPriceSnapshot: 0,
              quantity: 1,
              discountPercent: 0,
              discountAmount: 0,
              lineTotalBeforeDiscount: subtotal.toNumber(),
              lineTotalAfterDiscount: subtotal.toNumber(),
              lineTax: lineTax.toNumber(),
            },
          ],
        },
      },
    });

    if (depositApplied.greaterThan(0)) {
      await createPayment({ saleId: created.id, method: 'CASH', amount: depositApplied }, tx);
    }
    if (balanceDue.greaterThan(0)) {
      await createPayment({ saleId: created.id, method: 'CASH', amount: balanceDue }, tx);
    }

    if (appointment.customerId) {
      await addToSpendTotal(tenantId, appointment.customerId, totalAmount, tx);
    }

    await postSaleToAccounts(
      tx,
      tenantId,
      userId,
      created.id,
      created.id.slice(0, 8).toUpperCase(),
      buildSaleAccountLegs({ paymentMethod: 'CASH', totalAmount }),
    );

    await tx.appointment.update({
      where: { id: appointmentId },
      data: { saleId: created.id, isPaid: true },
    });

    return tx.sale.findUniqueOrThrow({
      where: { id: created.id },
      include: { lines: true, payments: true },
    });
  }, { maxWait: 10_000, timeout: 30_000 });

  // Commission belongs to the appointment's staff/doctor, not the operator who
  // clicked Convert (ARGUS #132). Non-blocking like the normal sale route.
  try {
    const attributedStaff = await prisma.user.findUnique({
      where: { id: attributedUserId },
      select: { commissionRate: true },
    });
    if (attributedStaff?.commissionRate) {
      await createCommissionRecord({
        tenantId,
        saleId: sale.id,
        userId: attributedUserId,
        baseAmount: sale.totalAmount,
        commissionRate: attributedStaff.commissionRate,
      });
    }
  } catch (commissionError) {
    console.warn('Appointment conversion commission failed:', commissionError);
  }

  await createAuditLog({
    tenantId,
    actorId: userId,
    actorRole,
    entityType: 'Appointment',
    entityId: appointmentId,
    action: 'CONVERT_TO_SALE',
    after: {
      saleId: sale.id,
      totalAmount: sale.totalAmount.toString(),
      taxAmount: sale.taxAmount.toString(),
      depositApplied: depositApplied.toString(),
    },
  });

  return sale;
}
