import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { createAuditLog } from '@/lib/services/audit.service';

/**
 * Public booking service for the customer-facing storefront.
 *
 * A public booking is created as a walk-in appointment (customer provides
 * name + phone). Because the Appointment model requires a `createdById`
 * (an internal user), we resolve the tenant's OWNER as the acting user so the
 * booking is attributed to the business owner, not a named staff member.
 */

/**
 * Attempt to book an available slot from the customer-facing page.
 *
 * Returns the created appointment, or throws:
 *  - `STAFF_UNAVAILABLE` when the slot is already booked / blocked
 *  - `SERVICE_NOT_FOUND` when the referenced service does not exist
 *  - `NO_OWNER` when the tenant has no OWNER user to attribute the booking to
 */
export async function createPublicAppointment(
  tenantId: string,
  input: {
    serviceId?: string | null;
    slotId?: string | null;
    staffId?: string | null;
    walkInName: string;
    walkInPhone: string;
    startTime: string;
    endTime: string;
    durationMins: number;
    price: number;
    notes?: string | null;
  },
) {
  const startTime = new Date(input.startTime);
  const endTime = new Date(input.endTime);

  // Resolve the acting owner for attribution + audit.
  const owner = await prisma.user.findFirst({
    where: { tenantId, role: 'OWNER', deletedAt: null },
    select: { id: true, role: true },
  });
  if (!owner) throw new Error('NO_OWNER');

  // Validate the service belongs to this tenant (optional).
  if (input.serviceId) {
    const service = await prisma.appointmentService.findFirst({
      where: { id: input.serviceId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!service) throw new Error('SERVICE_NOT_FOUND');
  }

  return prisma.$transaction(async (tx) => {
    // If a slot was selected, ensure it is still available and mark it booked.
    if (input.slotId) {
      const slot = await tx.appointmentSlot.findFirst({
        where: { id: input.slotId, tenantId },
        select: { id: true, isBooked: true, isBlocked: true },
      });
      if (!slot || slot.isBooked || slot.isBlocked) {
        throw new Error('STAFF_UNAVAILABLE');
      }
    }

    const appointment = await tx.appointment.create({
      data: {
        tenantId,
        title: input.serviceId ? 'Appointment' : 'Walk-in',
        startTime,
        endTime,
        durationMins: input.durationMins,
        price: new Prisma.Decimal(input.price).toFixed(2),
        depositAmount: 0,
        walkInName: input.walkInName,
        walkInPhone: input.walkInPhone,
        serviceId: input.serviceId ?? null,
        staffId: input.staffId ?? null,
        slotId: input.slotId ?? null,
        notes: input.notes ?? null,
        customerNotes: input.notes ?? null,
        createdById: owner.id,
      },
      include: { service: true, staff: { select: { id: true, email: true } } },
    });

    // Mark the slot as booked.
    if (input.slotId) {
      await tx.appointmentSlot.update({
        where: { id: input.slotId },
        data: { isBooked: true, appointmentId: appointment.id },
      });
    }

    await createAuditLog({
      tenantId,
      actorId: owner.id,
      actorRole: 'OWNER',
      entityType: 'Appointment',
      entityId: appointment.id,
      action: 'CREATE',
      after: { source: 'PUBLIC_WEBSITE', walkInName: input.walkInName, serviceId: input.serviceId },
    });

    return appointment;
  });
}
