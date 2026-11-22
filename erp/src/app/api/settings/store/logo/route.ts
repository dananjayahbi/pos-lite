import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { uploadFile } from '@/lib/storage';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB for the store logo

/**
 * Tenant self-service logo upload (Store profile → Store logo).
 *
 * The tenant is always taken from the session — never from the form — so an
 * OWNER/MANAGER can only replace their own logo. Files are stored through the
 * configured provider (Cloudflare R2 in production) and the public URL is
 * returned; the form persists it through PATCH /api/settings/store.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant associated' }, { status: 401 });
    }

    if (!hasPermission(session.user, PERMISSIONS.SETTINGS.manageStoreProfile)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Only JPEG, PNG and WebP images are accepted.' },
        { status: 400 },
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Logo must be under 2 MB.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadFile(buffer, `${tenantId}/logo/store-logo`, {
      contentType: file.type,
      folder: 'store-logos',
      maxSizeBytes: MAX_SIZE,
    });

    return NextResponse.json({ url: result.url });
  } catch (error) {
    console.error('Store logo upload error:', error);
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
