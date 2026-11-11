import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { toErrorResponse, unauthorized } from '@/lib/api/error-envelope';
import {
  formatExtension,
  getPayrollExportContext,
  periodLabel,
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
    const extension = formatExtension(request.nextUrl.searchParams.get('format'));
    const meta = {
      companyName: context.companyName,
      periodLabel: periodLabel(new Date(context.run.periodStart)),
      periodMonth: context.run.periodMonth,
      generatedAt: context.generatedAt,
    };
    const rows = toBankSheetRows(context);

    if (extension === 'xlsx') {
      const buffer = generateBankSheetXlsx(meta, rows);
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
