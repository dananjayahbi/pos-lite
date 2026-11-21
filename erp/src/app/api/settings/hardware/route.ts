import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requirePermissionResponse } from '@/lib/api/permission-guard';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { AUDIT_ACTIONS } from '@/lib/services/audit.service';
import { HardwareSettingsSchema } from '@/lib/validators/settings.validators';
import {
  hardwareSettingsAuditPayload,
  mergeHardwareSettings,
  readHardwareSettings,
  validateHardwareSettings,
} from '@/lib/settings/hardwareSettings.core';

export async function PATCH(request: NextRequest) {
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

    // M07-01 (BUG-80): permission gate replaces the CASHIER/STOCK_CLERK role
    // denylist so the API agrees with the sidebar's settings:hardware gate.
    // Order matters: the tenant check above runs FIRST so a tenantless
    // SUPER_ADMIN (who holds ALL_PERMISSIONS) is still rejected here.
    const forbidden = requirePermissionResponse(
      session.user,
      PERMISSIONS.SETTINGS.manageHardware,
    );
    if (forbidden) return forbidden;

    const body = (await request.json()) as Record<string, unknown>;

    // M07-03 (OBS-82): typed validation replaces the hand-parsing that silently
    // coerced bad values (invalid port → 9100, Boolean("false") → true).
    const parsed = HardwareSettingsSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path?.join('.') ?? 'body';
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: issue ? `${field}: ${issue.message}` : 'Invalid hardware settings',
          },
        },
        { status: 400 },
      );
    }

    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { settings: true },
    });

    const currentSettings = (tenant.settings as Record<string, unknown>) ?? {};
    const currentHardware = (currentSettings.hardware as Record<string, unknown>) ?? {};
    const currentPrinter = (currentHardware.printer as Record<string, unknown>) ?? {};

    // ARGUS #510: the seed and legacy rows store the printer flat
    // (`hardware.host`), while PATCH writes nested (`hardware.printer.host`).
    // Normalise on read so the saved host is visible and stay PATCH-shaped.
    const before = readHardwareSettings(currentSettings);
    const after = mergeHardwareSettings(before, parsed.data);

    // The network host is required only when the effective type is NETWORK.
    const validationError = validateHardwareSettings(after);
    if (validationError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: validationError } },
        { status: 400 },
      );
    }

    const printer = {
      ...currentPrinter,
      type: after.printerType,
      host: after.host,
      port: after.port,
    };

    const updatedSettings = {
      ...currentSettings,
      hardware: {
        ...currentHardware,
        // Mirror flat fields for legacy readers; nested remains canonical.
        type: after.printerType,
        host: after.host,
        port: after.port,
        printer,
        cashDrawerEnabled: after.cashDrawerEnabled,
        cfdEnabled: after.cfdEnabled,
      },
    };

    // The write and its audit row commit together: a changed printer address
    // without an audit row is the defect this fixes.
    const audit = hardwareSettingsAuditPayload(before, after);
    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.tenant.update({
        where: { id: tenantId },
        data: { settings: updatedSettings },
        select: { settings: true },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          actorId: session.user.id,
          actorRole: session.user.role,
          entityType: 'TenantSettings',
          entityId: tenantId,
          action: AUDIT_ACTIONS.SETTINGS_CHANGED,
          before: { ...audit.before },
          after: { ...audit.after },
        },
      });

      return next;
    });

    return NextResponse.json({ success: true, data: updated.settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update hardware settings';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 },
    );
  }
}
