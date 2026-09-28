import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requirePermissionResponse } from '@/lib/api/permission-guard';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { downloadFile } from '@/lib/storage';
import { getExtensionFromKey, buildDisplayFilename } from '@/lib/reports/saved-report-storage';

/** MIME map keyed by saved-report file extension. */
const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  csv: 'text/csv;charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/**
 * Download the generated artifact for a saved report.
 *
 * The stored object is streamed from object storage and returned with an
 * `Content-Disposition: attachment` header so the browser saves the file. If the
 * record has a public `fileUrl` (R2 public bucket) we could redirect there, but
 * streaming through the API keeps access control consistent with auth checks.
 */
export async function GET(
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

    const forbidden = requirePermissionResponse(session.user, PERMISSIONS.REPORT.viewSalesReport);
    if (forbidden) return forbidden;

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

    if (!savedReport.storageKey) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'No stored artifact for this report' } },
        { status: 404 },
      );
    }

    // `?view=1` renders the file inline (opens in the browser) instead of
    // triggering a download, so the stored artifact is viewed directly from
    // object storage without regenerating it.
    const url = new URL(request.url);
    const isInline = url.searchParams.get('view') === '1';

    const buffer = await downloadFile(savedReport.storageKey);
    const extension = getExtensionFromKey(savedReport.storageKey);
    const filename = buildDisplayFilename(savedReport.name, extension);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': MIME_BY_EXT[extension] ?? 'application/octet-stream',
        'Content-Disposition': `${isInline ? 'inline' : 'attachment'}; filename="${filename}"`,
        'Content-Length': String(buffer.byteLength),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('GET /api/reports/saved/[id]/download error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to download saved report' } },
      { status: 500 },
    );
  }
}
