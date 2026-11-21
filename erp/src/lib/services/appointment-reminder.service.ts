import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/services/email.service';
import { sendWhatsAppTextMessage } from '@/lib/whatsapp';
import { getAppointmentSettings } from '@/lib/services/appointment-settings.service';
import { enabledReminderOffsetsHours } from '@/lib/appointments/appointmentSettings.core';
import {
  summarizeReminderStatusCounts,
  type ReminderStatusCounts,
} from '@/lib/appointments/appointmentReminders.core';

interface ScheduleRemindersInput {
  appointmentId: string;
  tenantId: string;
}

/**
 * Create reminder records for an appointment.
 * Default schedule: 24h before, 2h before — each gated by the tenant's
 * appointment settings (ARGUS #124); both default to enabled.
 */
export async function scheduleReminders({ appointmentId, tenantId }: ScheduleRemindersInput) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, tenantId },
  });

  if (!appointment) throw new Error('APPOINTMENT_NOT_FOUND');

  const settings = await getAppointmentSettings(tenantId);
  const now = new Date();
  const reminders = enabledReminderOffsetsHours(settings)
    .map((hoursBefore) => {
      const scheduledFor = new Date(appointment.startTime);
      scheduledFor.setHours(scheduledFor.getHours() - hoursBefore);
      return scheduledFor;
    })
    .filter((scheduledFor) => scheduledFor > now)
    .map((scheduledFor) => ({
      appointmentId,
      tenantId,
      scheduledFor,
      channel: 'WHATSAPP' as const,
      status: 'PENDING' as const,
    }));

  if (reminders.length > 0) {
    await prisma.appointmentReminder.createMany({ data: reminders });
  }

  return reminders;
}

/**
 * Process all pending reminders that are due.
 * This should be called by a cron job every 15 minutes.
 */
export async function processPendingReminders() {
  const now = new Date();

  const pending = await prisma.appointmentReminder.findMany({
    where: {
      status: 'PENDING',
      scheduledFor: { lte: now },
    },
    include: {
      appointment: {
        include: {
          customer: true,
        },
      },
    },
    take: 50,
  });

  const results = [];
  for (const reminder of pending) {
    try {
      const appointment = reminder.appointment;
      const message = buildReminderMessage(appointment);

      // M27-08/OBS-77: the send path used to be a commented-out TODO that
      // unconditionally marked the row SENT — a fake-send that would corrupt
      // the ledger if ever wired. Actually attempt delivery per channel and
      // only mark SENT on provider success; otherwise FAILED with the reason.
      let delivered = false;
      let failure = 'No reachable contact channel for this appointment';

      const phone = appointment.walkInPhone ?? appointment.customer?.phone;
      const email = appointment.customer?.email;
      const wantsWhatsApp = reminder.channel === 'WHATSAPP' || reminder.channel === 'BOTH';
      const wantsEmail = reminder.channel === 'EMAIL' || reminder.channel === 'BOTH';

      if (wantsEmail && email) {
        const result = await sendEmail(email, `Appointment reminder: ${appointment.title}`, `<p>${message}</p>`);
        if (result.delivered) {
          delivered = true;
        } else {
          failure = `Email not delivered: ${result.reason ?? 'unknown'}`;
        }
      }

      if (!delivered && wantsWhatsApp && phone) {
        const result = await sendWhatsAppTextMessage(phone, message);
        if (result.success) {
          delivered = true;
        } else {
          failure = result.error ?? 'WhatsApp send failed';
        }
      }

      if (delivered) {
        await prisma.appointmentReminder.update({
          where: { id: reminder.id },
          data: { status: 'SENT', sentAt: new Date(), errorMessage: null },
        });
        results.push({ id: reminder.id, status: 'SENT' });
      } else {
        await prisma.appointmentReminder.update({
          where: { id: reminder.id },
          data: { status: 'FAILED', errorMessage: failure.slice(0, 500) },
        });
        results.push({ id: reminder.id, status: 'FAILED', error: failure });
      }
    } catch (error) {
      await prisma.appointmentReminder.update({
        where: { id: reminder.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      results.push({ id: reminder.id, status: 'FAILED' });
    }
  }

  return results;
}

export async function getReminderHistory(tenantId: string, appointmentId: string) {
  // M27-03/BUG-87: this used to filter on `appointmentId` alone, letting any
  // authenticated user of any tenant read another tenant's reminder history
  // (patient name/phone) by guessing ids. Scope to the caller's tenant.
  return prisma.appointmentReminder.findMany({
    where: { tenantId, appointmentId },
    orderBy: { scheduledFor: 'asc' },
  });
}

/**
 * ARGUS #135 — tenant-wide reminder queue for the Settings page, so the ~70
 * PENDING rows are visible with their delivery status instead of only as a
 * per-appointment aggregate. PENDING rows sort first, then by urgency.
 */
export function parseReminderLimit(value: string | null): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) return 25;
  return Math.min(Math.max(parsed, 1), 100);
}

export async function listTenantReminders(tenantId: string, limit = 25) {
  const take = Math.min(Math.max(Math.trunc(limit), 1), 100);

  const [reminders, grouped] = await Promise.all([
    prisma.appointmentReminder.findMany({
      where: { tenantId },
      orderBy: [{ status: 'asc' }, { scheduledFor: 'asc' }],
      take,
      include: {
        appointment: {
          select: {
            id: true,
            title: true,
            startTime: true,
            walkInName: true,
            customer: { select: { name: true } },
          },
        },
      },
    }),
    prisma.appointmentReminder.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { _all: true },
    }),
  ]);

  const summary = summarizeReminderStatusCounts(
    grouped.map((group) => ({ status: group.status, count: group._count._all })),
  );

  return { reminders, summary };
}

// Helper to build reminder message
export function buildReminderMessage(appointment: {
  title: string;
  startTime: Date;
  walkInName?: string | null;
  customer?: { name: string } | null;
}): string {
  const name = appointment.walkInName ?? appointment.customer?.name ?? 'Customer';
  const time = appointment.startTime.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return `Hi ${name}, this is a reminder for your appointment "${appointment.title}" on ${time}. See you soon!`;
}
