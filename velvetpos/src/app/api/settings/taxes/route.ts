import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';

const taxSettingsSchema = z.object({
  vatRate: z.number().min(0, 'VAT rate must be at least 0').max(100, 'VAT rate cannot exceed 100'),
  ssclRate: z.number().min(0, 'SSCL rate must be at least 0').max(100, 'SSCL rate cannot exceed 100'),
});

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

    if (!hasPermission(session.user, PERMISSIONS.SETTINGS.manageTax)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body = (await request.json()) as { vatRate?: number; ssclRate?: number };
    const parsed = taxSettingsSchema.safeParse({
      vatRate: Number(body.vatRate),
      ssclRate: Number(body.ssclRate),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }

    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { settings: true },
    });

    const currentSettings = typeof tenant.settings === 'object' && tenant.settings !== null
      ? (tenant.settings as Record<string, unknown>)
      : {};

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        settings: {
          ...currentSettings,
          vatRate: parsed.data.vatRate,
          ssclRate: parsed.data.ssclRate,
        },
      },
      select: { settings: true },
    });

    return NextResponse.json({ success: true, data: updated.settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save tax settings';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 },
    );
  }
}
