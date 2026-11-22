import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { toErrorResponse, unauthorized } from '@/lib/api/error-envelope';
import {
  allowsIncompleteExport,
  buildPayrollExportPreflight,
  formatExtension,
  getPayrollExportContext,
  periodLabel,
  recordPayrollExportDownload,
  toBankSheetRows,
} from '@/lib/services/payroll-exports.service';
import {
  bankSheetFilename,
  generateBankSheetPdf,
  generateBankSheetXlsx,
} from '@/lib/payroll/bank-sheet';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Authentication required');

    const tenantId = session.user.tenantId;
    if (!tenantId) return unauthorized('No tenant associated');
    if (!hasPermission(session.user, PERMISSIONS.PAYROLL.viewPayroll)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { id } = await params;
    const context = await getPayrollExportContext(tenantId, id);

    // ARGUS #378: never silently emit blank bank cells.
    const preflight = buildPayrollExportPreflight(context, 'bank-sheet');
    const incompleteOverride = allowsIncompleteExport(
      request.nextUrl.searchParams.get('allowIncomplete'),
    );
    if (!preflight.complete && !incompleteOverride) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'EXPORT_INCOMPLETE',
            message: preflight.message ?? 'Bank sheet is missing staff details',
            details: preflight,
          },
        },
        { status: 422 },
      );
    }

    const extension = formatExtension(request.nextUrl.searchParams.get('format'));
    const meta = {
      companyName: context.companyName,
      periodLabel: periodLabel(new Date(context.run.periodStart)),
      periodMonth: context.run.periodMonth,
      generatedAt: context.generatedAt,
      status: context.run.status,
      payment: context.payment,
      provenanceNote: context.provenance.caveat,
    };
    const rows = toBankSheetRows(context);

    if (extension === 'xlsx') {
      const buffer = generateBankSheetXlsx(meta, rows);
      await recordPayrollExportDownload({
        tenantId,
        runId: context.run.id,
        actorId: session.user.id,
        actorRole: session.user.role ?? 'UNKNOWN',
        exportType: 'bank-sheet',
        format: 'xlsx',
        periodMonth: context.run.periodMonth,
        itemCount: rows.length,
        incompleteOverride,
      });
      return new Response(new Uint8Array(buffer), {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${bankSheetFilename(meta, 'xlsx')}"`,
          'Content-Length': String(buffer.byteLength),
        },
      });
    }

    const buffer = generateBankSheetPdf(meta, rows);
    await recordPayrollExportDownload({
      tenantId,
      runId: context.run.id,
      actorId: session.user.id,
      actorRole: session.user.role ?? 'UNKNOWN',
      exportType: 'bank-sheet',
      format: 'pdf',
      periodMonth: context.run.periodMonth,
      itemCount: rows.length,
      incompleteOverride,
    });
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${bankSheetFilename(meta, 'pdf')}"`,
        'Content-Length': String(buffer.byteLength),
      },
    });
  } catch (error) {
    return toErrorResponse(error, 'GET /api/store/payroll/runs/[id]/exports/bank-sheet');
  }
}
