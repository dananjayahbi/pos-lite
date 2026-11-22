import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requirePermissionResponse } from '@/lib/api/permission-guard';
import { PERMISSIONS } from '@/lib/constants/permissions';
import {
  compileCustomerContactExport,
  recordAdHocContactExportDownload,
} from '@/lib/services/customer-contact-export.service';
import type { ContactExportScope } from '@/lib/services/customer-contact-export-core';
import { parseQueryInt } from '@/lib/api/query-params';
import { toErrorResponse } from '@/lib/api/error-envelope';

/**
 * Ad-hoc Customer Contact Export (doc 18).
 *
 * Lets an authorised user trigger a contact export on demand (outside the
 * scheduled cron run) and download the file directly. Requires
 * `broadcast:send` - the bulk-contact permission used by the composer family -
 * because the response is full contact PII for every matching customer, not a
 * single record a `customer:view` reader is entitled to. CASHIER holds
 * `customer:view` but not `broadcast:send`. One CONTACT_EXPORT_RUN audit row is
 * written per download (ARGUS #316).
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

    // Bulk contact PII: the composer's permission, not `customer:view`.
    // CASHIER holds customer:view/create but deliberately not broadcast:send.
    const forbidden = requirePermissionResponse(session.user, PERMISSIONS.BROADCAST.send);
    if (forbidden) return forbidden;

    const { searchParams } = new URL(request.url);
    const rawScope = searchParams.get('scope');
    const scope: ContactExportScope | undefined =
      rawScope === 'ALL' || rawScope === 'ACTIVE' || rawScope === 'NEW' || rawScope === 'REPEAT'
        ? rawScope
        : undefined;
    // XC-01: malformed activeDays now 400 (was unclamped Number()).
    const activeDays = parseQueryInt(searchParams, 'activeDays', { min: 1 });

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

    // ARGUS #316: compile-only used to leave no audit trail. Record the
    // download (actor + included count) before the file is returned.
    await recordAdHocContactExportDownload({
      compiled,
      actorId: session.user.id,
      actorRole: session.user.role,
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
    // XC-01/INF-02: parser ApiErrors surface as their 400; unknown
    // errors are logged and returned as a generic, leak-free 500.
    return toErrorResponse(error, 'GET /api/store/customers/contact-export');
  }
}
