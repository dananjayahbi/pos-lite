import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { deleteFile } from '@/lib/storage';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    const body = (await request.json()) as { urls: string[] };
    const urls = body.urls ?? [];

    if (urls.length === 0) {
      return NextResponse.json({ success: true, deleted: 0 });
    }

    // Extract the storage path from each URL
    const paths = urls
      .map((url) => {
        try {
          const parsed = new URL(url);
          return parsed.pathname.replace(/^\//, '');
        } catch {
          // If not a valid URL, treat as a direct path
          return url;
        }
      })
      .filter(Boolean);

    const results = await Promise.allSettled(
      paths.map((path) => deleteFile(path)),
    );

    const deleted = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return NextResponse.json({ success: true, deleted, failed });
  } catch (error) {
    console.error('POST /api/upload/website-asset/delete error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete media' } },
      { status: 500 },
    );
  }
}
