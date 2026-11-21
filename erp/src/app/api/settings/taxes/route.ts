import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { AUDIT_ACTIONS } from '@/lib/services/audit.service';
import {
  canManageTaxSettings,
  readTaxRates,
  taxSettingsAuditPayload,
} from '@/lib/settings/settingsAudit.core';

const taxSettingsSchema = z.object({
  vatRate: z.number().min(0, 'VAT rate must be at least 0').max(100, 'VAT rate cannot exceed 100'),
  ssclRate: z.number().min(0, 'SSCL rate must be at least 0').max(100, 'SSCL rate cannot exceed 100'),
});

/**
 * Read the tenant's store-wide tax rates.
 *
 * Any authenticated user of the tenant may read this: the POS cart needs the
 * rates to preview exactly the tax a sale will charge, and cashiers do not
 * hold the settings permission. Writing still requires SETTINGS.manageTax.
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

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    return NextResponse.json({ success: true, data: readTaxRates(tenant?.settings) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load tax settings';
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

    // ARGUS #468 — tax rates are owner-only. A manager with an explicit
    // per-user override still cannot pass: the role is checked, not just the
    // permission key.
    if (
      !canManageTaxSettings(session.user.role) ||
      !hasPermission(session.user, PERMISSIONS.SETTINGS.manageTax)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only the store owner can change tax rates',
          },
        },
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

    // Update + audit commit together: a changed tax rate without an audit row
    // would be the exact defect this fixes.
    const audit = taxSettingsAuditPayload(
      readTaxRates(currentSettings),
      { vatRate: parsed.data.vatRate, ssclRate: parsed.data.ssclRate },
    );

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.tenant.update({
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
    const message = error instanceof Error ? error.message : 'Failed to save tax settings';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 },
    );
  }
}
