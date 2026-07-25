import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const DENIED_ROLES = new Set(['CASHIER', 'STOCK_CLERK']);
const VALID_PRINTER_TYPES = new Set(['NETWORK', 'USB']);

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

    if (DENIED_ROLES.has(session.user.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const { printerType, host, port, cashDrawerEnabled, cfdEnabled } = body;

    if (typeof printerType !== 'string' || !VALID_PRINTER_TYPES.has(printerType)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid printer type' } },
        { status: 400 },
      );
    }

    if (printerType === 'NETWORK' && (typeof host !== 'string' || host.trim() === '')) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Host is required for network printers' },
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

    const updatedSettings = {
      ...currentSettings,
      hardware: {
        ...currentHardware,
        printer: {
          type: printerType,
          host: typeof host === 'string' ? host.trim() : '',
          port: typeof port === 'number' && port > 0 && port <= 65535 ? port : 9100,
        },
        cashDrawerEnabled: Boolean(cashDrawerEnabled),
        cfdEnabled: Boolean(cfdEnabled),
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
