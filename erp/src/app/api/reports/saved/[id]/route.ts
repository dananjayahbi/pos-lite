import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requirePermissionResponse } from '@/lib/api/permission-guard';
import { savedReportPermission } from '@/lib/reports/savedReportAccess.core';
import { deleteFile } from '@/lib/storage';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';
import { zSafeShortText } from '@/lib/validators/shared';
import { getClientIp } from '@/lib/utils/request';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 },
      );
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 },
      );
    }

    const { id } = await params;

    const savedReport = await prisma.savedReport.findFirst({
      where: { id, tenantId, userId: session.user.id },
    });

    if (!savedReport) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Saved report not found' } },
        { status: 404 },
      );
    }

    const typeForbidden = requirePermissionResponse(
      session.user,
      savedReportPermission(savedReport.reportType),
    );
    if (typeForbidden) return typeForbidden;

    return NextResponse.json({ success: true, data: savedReport });
  } catch (error) {
    console.error('GET /api/reports/saved/[id] error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to load saved report' } },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 },
      );
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 },
      );
    }

    // ARGUS #448 - rename used to validate only "non-empty", while POST used
    // the shared short-text guard (trim, 1-100 chars, no markup). One rule now
    // applies to both, and the UI mirrors it before submitting.
    const parsed = z.object({ name: zSafeShortText(100) }).safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues.map((issue) => issue.message).join(', '),
          },
        },
        { status: 400 },
      );
    }
    const name = parsed.data.name;

    const { id } = await params;
    const existing = await prisma.savedReport.findFirst({
      where: { id, tenantId, userId: session.user.id },
      select: { reportType: true, name: true },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Saved report not found' } },
        { status: 404 },
      );
    }

    const typeForbidden = requirePermissionResponse(
      session.user,
      savedReportPermission(existing.reportType),
    );
    if (typeForbidden) return typeForbidden;

    const updated = await prisma.savedReport.updateMany({
      where: { id, tenantId, userId: session.user.id },
      data: { name },
    });

    if (updated.count === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Saved report not found' } },
        { status: 404 },
      );
    }

    void createAuditLog({
      tenantId,
      actorId: session.user.id,
      actorRole: session.user.role,
      entityType: 'SavedReport',
      entityId: id,
      action: AUDIT_ACTIONS.SAVED_REPORT_RENAMED,
      before: { name: existing.name },
      after: { name },
      ipAddress: getClientIp(request),
      userAgent: request.headers.get('user-agent') ?? undefined,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PUT /api/reports/saved/[id] error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update saved report' } },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 },
      );
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 },
      );
    }

    const { id } = await params;

    const existing = await prisma.savedReport.findFirst({
      where: { id, tenantId, userId: session.user.id },
      select: { storageKey: true, reportType: true, name: true, format: true },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Saved report not found' } },
        { status: 404 },
      );
    }

    const typeForbidden = requirePermissionResponse(
      session.user,
      savedReportPermission(existing.reportType),
    );
    if (typeForbidden) return typeForbidden;

    // ARGUS #448 - remove the stored artifact BEFORE the row. The old order
    // deleted the DB row first, so a storage failure left an unreferenced
    // object behind with nothing to point at it. File-first is retry-safe: if
    // the row delete fails the preset remains and can be deleted again.
    if (existing.storageKey) {
      await deleteFile(existing.storageKey);
    }

    const deleted = await prisma.savedReport.deleteMany({
      where: {
        id,
        tenantId,
        userId: session.user.id,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Saved report not found' } },
        { status: 404 },
      );
    }

    void createAuditLog({
      tenantId,
      actorId: session.user.id,
      actorRole: session.user.role,
      entityType: 'SavedReport',
      entityId: id,
      action: AUDIT_ACTIONS.SAVED_REPORT_DELETED,
      before: {
        name: existing.name,
        reportType: existing.reportType,
        format: existing.format,
        storageKey: existing.storageKey,
      },
      ipAddress: getClientIp(_request),
      userAgent: _request.headers.get('user-agent') ?? undefined,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/reports/saved/[id] error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete saved report' } },
      { status: 500 },
    );
  }
}