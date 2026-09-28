import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requirePermissionResponse } from '@/lib/api/permission-guard';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { HardwareSettingsSchema } from '@/lib/validators/settings.validators';

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
    const { printerType, host } = body;

    if (printerType === 'NETWORK' && (typeof host !== 'string' || host.trim() === '')) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Host is required for network printers' },
        },
        { status: 400 },
      );
    }

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

    const updatedSettings = {
      ...currentSettings,
      hardware: {
        ...currentHardware,
        printer: {
          ...currentPrinter,
          type: parsed.data.printerType,
          host: parsed.data.host,
          // PATCH semantics: an omitted port keeps the stored value (falling
          // back to the standard 9100 only when none was ever configured).
          // Invalid/explicit ports are rejected above — no silent coercion.
          port: parsed.data.port ?? (typeof currentPrinter.port === 'number' ? currentPrinter.port : 9100),
        },
        cashDrawerEnabled: parsed.data.cashDrawerEnabled,
        cfdEnabled: parsed.data.cfdEnabled,
      },
    };

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: updatedSettings },
      select: { settings: true },
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
