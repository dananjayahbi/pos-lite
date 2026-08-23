import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { compileCustomerContactExport } from '@/lib/services/customer-contact-export.service';
import type { ContactExportScope } from '@/lib/services/customer-contact-export-core';

/**
 * Ad-hoc Customer Contact Export (doc 18).
 *
 * Lets owner/staff trigger a contact export on demand (outside the scheduled
 * cron run) and download the file directly. Requires the `customer:view`
 * permission. Scope is optional and defaults to the configured value.
 */
export async function GET(request: NextRequest) {
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

    if (!hasPermission(session.user, PERMISSIONS.CUSTOMER.viewCustomer)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const rawScope = searchParams.get('scope');
    const scope: ContactExportScope | undefined =
      rawScope === 'ALL' || rawScope === 'ACTIVE' || rawScope === 'NEW' || rawScope === 'REPEAT'
        ? rawScope
        : undefined;
    const activeDays = searchParams.get('activeDays')
      ? Number(searchParams.get('activeDays'))
      : undefined;

    const compiled = await compileCustomerContactExport({
      tenantId,
      scope,
      activeDays:
        activeDays !== undefined && Number.isFinite(activeDays) && activeDays > 0
          ? activeDays
          : undefined,
      actorRole: session.user.role,
      actorId: session.user.id,
    });

    const isXlsx = compiled.format === 'xlsx';
    const body = isXlsx
      ? Buffer.from(compiled.content)
      : new TextEncoder().encode(String(compiled.content));

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': isXlsx
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${compiled.filename}"`,
        'Content-Length': String(body.byteLength),
      },
    });
  } catch (error) {
    console.error('GET /api/store/customers/contact-export error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to export contacts' } },
      { status: 500 },
    );
  }
}
