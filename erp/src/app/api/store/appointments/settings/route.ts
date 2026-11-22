import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import {
  getAppointmentSettings,
  saveAppointmentSettings,
} from '@/lib/services/appointment-settings.service';
import { AppointmentSettingsSchema } from '@/lib/validators/appointment.validators';
import { createAuditLog } from '@/lib/services/audit.service';
import type { Prisma } from '@/generated/prisma/client';

/**
 * ARGUS #124 — tenant-scoped appointment settings, stored in
 * `Tenant.settings.appointments.settings`. Gated like the Settings tab itself
 * (`appointment:settings:manage`); a missing tenant resolves to a 401 rather
 * than leaking another tenant's configuration.
 */

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'No tenant associated' } },
        { status: 401 },
      );
    }

    if (!hasPermission(session.user, PERMISSIONS.APPOINTMENT.manageSettings)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const settings = await getAppointmentSettings(tenantId);

    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error('GET /api/store/appointments/settings error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'No tenant associated' } },
        { status: 401 },
      );
    }

    if (!hasPermission(session.user, PERMISSIONS.APPOINTMENT.manageSettings)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = AppointmentSettingsSchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: errors } },
        { status: 400 },
      );
    }

    const previous = await getAppointmentSettings(tenantId);
    const settings = await saveAppointmentSettings(tenantId, parsed.data);

    await createAuditLog({
      tenantId,
      actorId: session.user.id,
      actorRole: session.user.role,
      entityType: 'Tenant',
      entityId: tenantId,
      action: 'APPOINTMENT_SETTINGS_UPDATED',
      before: previous as unknown as Prisma.InputJsonValue,
      after: settings as unknown as Prisma.InputJsonValue,
    });

    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error('PATCH /api/store/appointments/settings error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
