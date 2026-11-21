import 'server-only';

import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import {
  normalizeAppointmentSettings,
  parseAppointmentSettings,
  type AppointmentSettings,
} from '@/lib/appointments/appointmentSettings.core';

/**
 * ARGUS #124 — appointment settings live in `Tenant.settings.appointments.settings`
 * so they can be persisted without a schema migration. Reads are per-field
 * defensive: a hand-edited or partial blob falls back to the documented
 * defaults.
 */

function readSettingsBlob(settings: unknown): {
  current: Record<string, unknown>;
  appointments: Record<string, unknown>;
} {
  const current =
    settings && typeof settings === 'object' && !Array.isArray(settings)
      ? ({ ...(settings as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  const appointments =
    current.appointments && typeof current.appointments === 'object' && !Array.isArray(current.appointments)
      ? ({ ...(current.appointments as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  return { current, appointments };
}

export async function getAppointmentSettings(tenantId: string): Promise<AppointmentSettings> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  return parseAppointmentSettings(tenant?.settings);
}

export async function saveAppointmentSettings(
  tenantId: string,
  input: Partial<AppointmentSettings>,
): Promise<AppointmentSettings> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });

  const { current, appointments } = readSettingsBlob(tenant?.settings);
  const settings = normalizeAppointmentSettings(input);

  const nextSettings: Prisma.InputJsonValue = {
    ...current,
    appointments: {
      ...appointments,
      settings: settings as unknown as Prisma.InputJsonValue,
    },
  };

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: nextSettings },
  });

  return settings;
}
