import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import { requirePermissionResponse } from '@/lib/api/permission-guard';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { generateReportFile, type GeneratedFormat } from '@/lib/reports/generate-report';
import { REPORT_SLUGS, resolveReportColumns, resolveReportTitle } from '@/lib/reports/report-config';
import {
  SAVED_REPORT_SNAPSHOT_KEY,
  filterSnapshotColumns,
  savedReportPermission,
} from '@/lib/reports/savedReportAccess.core';
import { buildSavedReportKey } from '@/lib/reports/saved-report-storage';
import type { ReportColumn } from '@/lib/reports/export';
import { zSafeShortText } from '@/lib/validators/shared';
import { uploadFile } from '@/lib/storage';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';
import { getClientIp } from '@/lib/utils/request';

/**
 * M34-01 (BUG-78): `reportType` used to be any non-empty string, and it is
 * persisted then turned into the "Open in App" href — a stored `//evil.com`
 * became a protocol-relative off-site link. It is now restricted to the slugs
 * the app can actually render (derived from the report registry, not hand-listed).
 *
 * M34-02 (BUG-77): `name` is free text that reaches the saved-report list and
 * the generated artifact, so it uses the shared XC-04 short-text guard, which
 * rejects control markup instead of trying to strip it.
 */
const createSavedReportSchema = z.object({
  // zSafeShortText already trims and requires ≥1 char, so no extra refine here.
  name: zSafeShortText(100),
  reportType: z.enum(REPORT_SLUGS as [string, ...string[]]),
  filters: z.record(z.string(), z.unknown()),
  format: z.enum(['pdf', 'csv', 'xlsx']).default('pdf'),
  // Rows + columns are provided by the client so the generated artifact includes
  // the exact data the user was looking at.
  rows: z.array(z.record(z.string(), z.unknown())).default([]),
  columns: z
    .array(
      z.object({
        key: z.string(),
        header: z.string(),
        width: z.number().optional(),
      }),
    )
    .default([]),
  title: z.string().optional(),
  dateRange: z.string().optional(),
});

function getDateRange(filters: Record<string, unknown>): string {
  const from = typeof filters.from === 'string' ? filters.from : '';
  const to = typeof filters.to === 'string' ? filters.to : '';
  if (from && to) return `${from} to ${to}`;
  if (from) return `From ${from}`;
  if (to) return `Until ${to}`;
  return '';
}

export async function GET() {
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

    const reports = await prisma.savedReport.findMany({
      where: {
        tenantId,
        userId: session.user.id,
      },
      orderBy: { createdAt: 'desc' },
    });

    // A saved report is only listed when the user can view its report type
    // (ARGUS #446), not merely the sales-report key.
    const visible = reports.filter((report) =>
      hasPermission(session.user, savedReportPermission(report.reportType)),
    );

    return NextResponse.json({ success: true, data: visible });
  } catch (error) {
    console.error('GET /api/reports/saved error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch saved reports' } },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
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

    // Creating a saved report generates and uploads an artifact, which is an
    // export operation (ARGUS #438).
    const forbidden = requirePermissionResponse(session.user, PERMISSIONS.REPORT.exportReport);
    if (forbidden) return forbidden;

    const body: unknown = await request.json();
    const parsed = createSavedReportSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map((i) => i.message).join(', ') } },
        { status: 400 },
      );
    }

    const data = parsed.data;

    // Authorize the artifact by the report type it actually contains
    // (ARGUS #446), not by the sales key.
    const typeForbidden = requirePermissionResponse(
      session.user,
      savedReportPermission(data.reportType),
    );
    if (typeForbidden) return typeForbidden;

    // → Generate the artifact file (CSV / XLSX / PDF) as a Buffer.
    // The key is namespaced under `saved_reports/{tenant}/{user}/`.
    const title = data.title ?? resolveReportTitle(data.reportType);
    const dateRange = data.dateRange ?? getDateRange(data.filters);
    const format: GeneratedFormat = data.format === 'xlsx' ? 'xlsx' : data.format;

    // Normalise client-supplied columns to the ReportColumn shape (drop any
    // `undefined` width so `exactOptionalPropertyTypes` is satisfied) and keep
    // only columns the report definition owns (ARGUS #446).
    const serverColumns = resolveReportColumns(data.reportType, data.rows);
    const allowedClientColumns = filterSnapshotColumns(data.columns, serverColumns);
    const columns: ReportColumn[] =
      allowedClientColumns.length > 0
        ? allowedClientColumns.map<ReportColumn>((c) =>
            c.width === undefined
              ? { key: c.key, header: c.header }
              : { key: c.key, header: c.header, width: c.width },
          )
        : serverColumns;

    const snapshotFilters = {
      ...data.filters,
      [SAVED_REPORT_SNAPSHOT_KEY]: {
        asOf: new Date().toISOString(),
        source: 'CLIENT_SNAPSHOT',
      },
    };

    const generated = generateReportFile(format, data.rows, columns, title, dateRange);

    const storageKey = buildSavedReportKey({
      tenantId,
      userId: session.user.id,
      name: data.name,
      extension: generated.extension,
    });

    const uploadResult = await uploadFile(generated.buffer, storageKey, {
      contentType: generated.contentType,
      usePathAsKey: true,
    });

    const report = await prisma.savedReport.create({
      data: {
        tenantId,
        userId: session.user.id,
        name: data.name,
        reportType: data.reportType,
        filters: snapshotFilters as unknown as Prisma.InputJsonValue,
        format: generated.extension,
        storageKey: uploadResult.path,
        fileUrl: uploadResult.url,
      },
    });

    // ARGUS #448 - saved-report create/rename/delete/download now leave an
    // audit trail (they previously wrote nothing).
    void createAuditLog({
      tenantId,
      actorId: session.user.id,
      actorRole: session.user.role,
      entityType: 'SavedReport',
      entityId: report.id,
      action: AUDIT_ACTIONS.SAVED_REPORT_CREATED,
      after: {
        name: report.name,
        reportType: report.reportType,
        format: report.format,
        rowCount: data.rows.length,
      },
      ipAddress: getClientIp(request),
      userAgent: request.headers.get('user-agent') ?? undefined,
    }).catch(() => {});

    return NextResponse.json({ success: true, data: report }, { status: 201 });
  } catch (error) {
    console.error('POST /api/reports/saved error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create saved report' } },
      { status: 500 },
    );
  }
}
