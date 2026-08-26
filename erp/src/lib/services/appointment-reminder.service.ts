import { prisma } from '@/lib/prisma';

interface ScheduleRemindersInput {
  appointmentId: string;
  tenantId: string;
}

/**
 * Create reminder records for an appointment.
 * Default schedule: 24h before, 2h before
 */
export async function scheduleReminders({ appointmentId, tenantId }: ScheduleRemindersInput) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, tenantId },
  });

  if (!appointment) throw new Error('APPOINTMENT_NOT_FOUND');

  const reminders = [];

  // 24-hour reminder
  const reminder24h = new Date(appointment.startTime);
  reminder24h.setHours(reminder24h.getHours() - 24);
  if (reminder24h > new Date()) {
    reminders.push({
      appointmentId,
      tenantId,
      scheduledFor: reminder24h,
      channel: 'WHATSAPP' as const,
      status: 'PENDING' as const,
    });
  }

  // 2-hour reminder
  const reminder2h = new Date(appointment.startTime);
  reminder2h.setHours(reminder2h.getHours() - 2);
  if (reminder2h > new Date()) {
    reminders.push({
      appointmentId,
      tenantId,
      scheduledFor: reminder2h,
      channel: 'WHATSAPP' as const,
      status: 'PENDING' as const,
    });
  }

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
      const phone = reminder.appointment.walkInPhone ?? reminder.appointment.customer?.phone;

      if (phone && reminder.channel !== 'EMAIL') {
        // TODO: Integrate with WhatsApp service when available
        // await sendWhatsAppMessage(phone, buildReminderMessage(reminder.appointment));
      }

      // For now, mark as sent
      await prisma.appointmentReminder.update({
        where: { id: reminder.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
        },
      });

      results.push({ id: reminder.id, status: 'SENT' });
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

export async function getReminderHistory(appointmentId: string) {
  return prisma.appointmentReminder.findMany({
    where: { appointmentId },
    orderBy: { scheduledFor: 'asc' },
  });
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
