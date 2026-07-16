import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { testDrawer } from '@/lib/hardware/cashDrawer';
import type { PrinterConfig } from '@/lib/hardware/printer';

const DENIED_ROLES = new Set(['CASHIER', 'STOCK_CLERK']);

export async function POST() {
  const startedAt = Date.now();
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

    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const settings = tenant.settings as Record<string, unknown> | null;
    const hw = (settings as any)?.hardware?.printer;

    const printerConfig: PrinterConfig = {
      type: hw?.type ?? 'NETWORK',
      host: hw?.host,
      port: hw?.port,
      paperWidth: hw?.paperWidth ?? '58mm',
    };

    await testDrawer(printerConfig);

    return NextResponse.json({
      success: true,
      data: {
        message: 'Cash drawer kick sent successfully',
        details: printerConfig.type === 'NETWORK'
          ? `Kick pulse was sent through ${printerConfig.host ?? 'configured host'}:${printerConfig.port ?? 9100}.`
          : 'Drawer pulse was sent using the connected USB printer.',
        durationMs: Date.now() - startedAt,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown drawer error';
    return NextResponse.json(
      { success: false, error: { code: 'DRAWER_ERROR', message } },
      { status: 500 },
    );
  }
}
