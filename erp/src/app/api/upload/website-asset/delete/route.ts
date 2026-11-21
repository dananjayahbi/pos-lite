import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requirePermissionResponse } from '@/lib/api/permission-guard';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { deleteFile } from '@/lib/storage';
import { extractTenantAssetPath } from '@/lib/storage/asset-paths';

const MAX_DELETE_BATCH = 50;

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    // Deleting website media is owner/manager work (ARGUS #496).
    const forbidden = requirePermissionResponse(session.user, PERMISSIONS.SETTINGS.manageWebsite);
    if (forbidden) return forbidden;

    const tenantId = session.user.tenantId;
    const body = (await request.json().catch(() => null)) as { urls?: unknown } | null;
    const urls = Array.isArray(body?.urls)
      ? body.urls.filter((url): url is string => typeof url === 'string' && url.length > 0)
      : [];

    if (urls.length === 0) {
      return NextResponse.json({ success: true, deleted: 0, failed: 0, rejected: 0 });
    }
    if (urls.length > MAX_DELETE_BATCH) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Delete at most ${MAX_DELETE_BATCH} assets at a time`,
          },
        },
        { status: 400 },
      );
    }

    // Only keys that belong to the caller's tenant may be deleted. Anything
    // else (another tenant's object, an arbitrary bucket path, traversal) is
    // rejected rather than attempted.
    const scopedPaths: string[] = [];
    let rejected = 0;
    for (const url of urls) {
      const path = extractTenantAssetPath(url, tenantId);
      if (path) scopedPaths.push(path);
      else rejected += 1;
    }

    const results = await Promise.allSettled(
      scopedPaths.map((path) => deleteFile(path)),
    );

    const deleted = results.filter((result) => result.status === 'fulfilled').length;
    const failed = results.filter((result) => result.status === 'rejected').length;

    return NextResponse.json({ success: true, deleted, failed, rejected });
  } catch (error) {
    console.error('POST /api/upload/website-asset/delete error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete media' } },
      { status: 500 },
    );
  }
}
