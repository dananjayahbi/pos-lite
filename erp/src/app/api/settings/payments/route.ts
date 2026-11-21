import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@/generated/prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { readLankaQrSettingsFromTenantSettings } from '@/lib/payments/lanka-qr-config';
import { LankaQrSettingsSchema } from '@/lib/validators/lanka-qr.validators';
import { writeAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';

/** Reads the tenant's LankaQR configuration (owner/manager settings surface). */
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

    // The QR is a payment destination: owners only (ARGUS #509).
    if (session.user.role !== 'OWNER' && session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only an owner can manage payment settings' } },
        { status: 403 },
      );
    }

    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { settings: true },
    });

    return NextResponse.json({
      success: true,
      data: readLankaQrSettingsFromTenantSettings(tenant.settings),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load payment settings';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 },
    );
  }
}

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

    // The QR is a payment destination: owners only (ARGUS #509).
    if (session.user.role !== 'OWNER' && session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only an owner can manage payment settings' } },
        { status: 403 },
      );
    }

    const body: unknown = await request.json();
    const parsed = LankaQrSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid input',
          },
        },
        { status: 400 },
      );
    }

    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { settings: true },
    });

    const currentSettings =
      typeof tenant.settings === 'object' && tenant.settings !== null
        ? (tenant.settings as Record<string, unknown>)
        : {};

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        settings: {
          ...currentSettings,
          lankaQr: parsed.data,
        },
      },
      select: { settings: true },
    });

    // A changed payment destination is security-relevant: audit it durably.
    await writeAuditLog({
      tenantId,
      actorId: session.user.id,
      actorRole: session.user.role,
      entityType: 'TenantSettings',
      entityId: tenantId,
      action: AUDIT_ACTIONS.SETTINGS_CHANGED,
      before: { lankaQr: readLankaQrSettingsFromTenantSettings(tenant.settings) } as unknown as Prisma.InputJsonValue,
      after: { lankaQr: parsed.data } as unknown as Prisma.InputJsonValue,
    });

    return NextResponse.json({
      success: true,
      data: readLankaQrSettingsFromTenantSettings(updated.settings),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save payment settings';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 },
    );
  }
}
