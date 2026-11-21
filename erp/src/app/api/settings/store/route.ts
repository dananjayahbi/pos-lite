import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { AUDIT_ACTIONS } from '@/lib/services/audit.service';
import {
  readStoreProfileSnapshot,
  storeProfileAuditPayload,
} from '@/lib/settings/settingsAudit.core';

const storeProfileSchema = z.object({
  storeName: z.string().trim().min(2, 'Store name must be at least 2 characters').max(80),
  logoUrl: z.string().trim().url('Logo URL must be a valid URL').or(z.literal('')),
  address: z.string().trim().max(160, 'Address must be 160 characters or less'),
  phoneNumber: z.string().trim().max(40, 'Phone number must be 40 characters or less'),
  receiptFooter: z.string().trim().max(240, 'Receipt footer must be 240 characters or less'),
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

    if (!hasPermission(session.user, PERMISSIONS.SETTINGS.manageStoreProfile)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body: unknown = await request.json();
    const parsed = storeProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }

    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { name: true, logoUrl: true, settings: true },
    });

    const currentSettings = typeof tenant.settings === 'object' && tenant.settings !== null
      ? (tenant.settings as Record<string, unknown>)
      : {};

    const updatedSettings = {
      ...currentSettings,
      address: parsed.data.address,
      phoneNumber: parsed.data.phoneNumber,
      receiptFooter: parsed.data.receiptFooter,
    };

    // ARGUS #468: profile edits stay manager-editable, but every write carries
    // an audit row with actor + the profile fields only (never other settings).
    const audit = storeProfileAuditPayload(
      readStoreProfileSnapshot({
        name: tenant.name,
        logoUrl: tenant.logoUrl,
        settings: tenant.settings,
      }),
      {
        storeName: parsed.data.storeName,
        logoUrl: parsed.data.logoUrl || null,
        address: parsed.data.address,
        phoneNumber: parsed.data.phoneNumber,
        receiptFooter: parsed.data.receiptFooter,
      },
    );

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.tenant.update({
        where: { id: tenantId },
        data: {
          name: parsed.data.storeName,
          logoUrl: parsed.data.logoUrl || null,
          settings: updatedSettings,
        },
        select: {
          name: true,
          logoUrl: true,
          settings: true,
        },
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

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save store profile';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 },
    );
  }
}
