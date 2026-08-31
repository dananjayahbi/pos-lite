import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import { requirePermissionResponse } from '@/lib/api/permission-guard';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { generateReportFile, type GeneratedFormat } from '@/lib/reports/generate-report';
import { resolveReportColumns, resolveReportTitle } from '@/lib/reports/report-config';
import { buildSavedReportKey } from '@/lib/reports/saved-report-storage';
import type { ReportColumn } from '@/lib/reports/export';
import { uploadFile } from '@/lib/storage';

const createSavedReportSchema = z.object({
  name: z.string().min(1).max(100),
  reportType: z.string().min(1),
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

    const forbidden = requirePermissionResponse(session.user, PERMISSIONS.REPORT.viewSalesReport);
    if (forbidden) return forbidden;

    const reports = await prisma.savedReport.findMany({
      where: {
        tenantId,
        userId: session.user.id,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: reports });
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

    const forbidden = requirePermissionResponse(session.user, PERMISSIONS.REPORT.viewSalesReport);
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

    // → Generate the artifact file (CSV / XLSX / PDF) as a Buffer.
    // The key is namespaced under `saved_reports/{tenant}/{user}/`.
    const title = data.title ?? resolveReportTitle(data.reportType);
    const dateRange = data.dateRange ?? getDateRange(data.filters);
    const format: GeneratedFormat = data.format === 'xlsx' ? 'xlsx' : data.format;

    // Normalise client-supplied columns to the ReportColumn shape (drop any
    // `undefined` width so `exactOptionalPropertyTypes` is satisfied).
    const columns: ReportColumn[] =
      data.columns.length > 0
        ? data.columns.map<ReportColumn>((c) =>
            c.width === undefined
              ? { key: c.key, header: c.header }
              : { key: c.key, header: c.header, width: c.width },
          )
        : resolveReportColumns(data.reportType, data.rows);

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
        filters: data.filters as unknown as Prisma.InputJsonValue,
        format: generated.extension,
        storageKey: uploadResult.path,
        fileUrl: uploadResult.url,
      },
    });

    return NextResponse.json({ success: true, data: report }, { status: 201 });
  } catch (error) {
    console.error('POST /api/reports/saved error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create saved report' } },
      { status: 500 },
    );
  }
}
