import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { AUDIT_ACTIONS } from '@/lib/services/audit.service';
import { canManageTaxSettings } from '@/lib/settings/settingsAudit.core';
import {
  readTaxSchedule,
  rejectTaxChange,
  taxSchedulePatch,
  todayIso,
  type TaxChangeRejection,
} from '@/lib/settings/taxSettingsChange.core';

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Effective date must be a YYYY-MM-DD date')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)), {
    message: 'Effective date is not a real date',
  });

const taxSettingsSchema = z.object({
  vatRate: z.number().min(0, 'VAT rate must be at least 0').max(100, 'VAT rate cannot exceed 100'),
  ssclRate: z.number().min(0, 'SSCL rate must be at least 0').max(100, 'SSCL rate cannot exceed 100'),
  // Optimistic concurrency: the version the operator's form loaded.
  expectedVersion: z.number().int().min(0).optional(),
  // Defaults to today; a future date schedules the rate (ARGUS #475).
  effectiveFrom: dateString.optional(),
  // Explicit confirmation for a 0% rate; required server-side.
  acknowledgeZeroRate: z.boolean().optional(),
});

class TaxWriteRejected extends Error {
  constructor(readonly rejection: TaxChangeRejection) {
    super(rejection.message);
  }
}

/**
 * Read the tenant's store-wide tax rates.
 *
 * Any authenticated user of the tenant may read this: the POS cart needs the
 * rates to preview exactly the tax a sale will charge, and cashiers do not
 * hold the settings permission. The response carries the *active* rates plus
 * the schedule metadata so the settings form can send a version and show a
 * pending change.
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

    const schedule = readTaxSchedule(tenant?.settings, todayIso());
    return NextResponse.json({
      success: true,
      data: {
        vatRate: schedule.active.vatRate,
        ssclRate: schedule.active.ssclRate,
        version: schedule.version,
        effectiveFrom: schedule.effectiveFrom,
        updatedAt: schedule.updatedAt,
        pending: schedule.pending,
      },
    });
  } catch (error) {
    console.error('GET /api/settings/taxes error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to load tax settings' },
      },
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

    const body = (await request.json()) as {
      vatRate?: number;
      ssclRate?: number;
      expectedVersion?: number;
      effectiveFrom?: string;
      acknowledgeZeroRate?: boolean;
    };
    const parsed = taxSettingsSchema.safeParse({
      vatRate: Number(body.vatRate),
      ssclRate: Number(body.ssclRate),
      expectedVersion: body.expectedVersion,
      effectiveFrom: body.effectiveFrom,
      acknowledgeZeroRate: body.acknowledgeZeroRate,
    });

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

    const today = todayIso();
    const effectiveFrom = parsed.data.effectiveFrom ?? today;

    // One transaction + a row lock serialises two managers editing the same
    // form: the second writer sees the first writer's version and gets 409
    // instead of silently overwriting the rates (ARGUS #475).
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM "Tenant" WHERE id = ${tenantId} FOR UPDATE`;

      const tenant = await tx.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { settings: true },
      });

      const schedule = readTaxSchedule(tenant.settings, today);
      const rejection = rejectTaxChange({
        current: schedule.active,
        currentVersion: schedule.version,
        next: { vatRate: parsed.data.vatRate, ssclRate: parsed.data.ssclRate },
        expectedVersion: parsed.data.expectedVersion ?? null,
        acknowledgeZeroRate: parsed.data.acknowledgeZeroRate ?? false,
        effectiveFrom,
        today,
      });
      if (rejection) throw new TaxWriteRejected(rejection);

      const patch = taxSchedulePatch({
        settings: tenant.settings,
        next: { vatRate: parsed.data.vatRate, ssclRate: parsed.data.ssclRate },
        effectiveFrom,
        today,
      });

      const updated = await tx.tenant.update({
        where: { id: tenantId },
        data: { settings: patch.settings as Prisma.InputJsonValue },
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
          before: { ...patch.audit.before, effectiveFrom: schedule.effectiveFrom },
          after: {
            vatRate: parsed.data.vatRate,
            ssclRate: parsed.data.ssclRate,
            effectiveFrom,
            version: patch.version,
          },
        },
      });

      return { updated, patch };
    });

    return NextResponse.json({ success: true, data: result.updated.settings });
  } catch (error) {
    if (error instanceof TaxWriteRejected) {
      const status = error.rejection.code === 'VERSION_CONFLICT' ? 409 : 422;
      return NextResponse.json(
        { success: false, error: { code: error.rejection.code, message: error.rejection.message } },
        { status },
      );
    }

    console.error('PATCH /api/settings/taxes error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to save tax settings' },
      },
      { status: 500 },
    );
  }
}
