import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { uploadFile } from '@/lib/storage';
import {
  LANKA_QR_IMAGE_MAX_BYTES,
  lankaQrUploadError,
} from '@/lib/payments/lanka-qr-upload.core';

/**
 * Tenant-scoped LankaQR static-image upload (ARGUS #516).
 *
 * The QR image is a payment destination: like `PATCH /api/settings/payments`
 * (ARGUS #509) this endpoint is OWNER/SUPER_ADMIN only and always uses the
 * session tenant, never a tenant id from the form. It only stores the file and
 * returns its URL; the audited payments PATCH persists `settings.lankaQr`.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant associated' }, { status: 401 });
    }

    if (session.user.role !== 'OWNER' && session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Only an owner can manage payment settings' },
        { status: 403 },
      );
    }

    const formData = await req.formData();
    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const rejection = lankaQrUploadError({ type: file.type, size: file.size });
    if (rejection) {
      return NextResponse.json({ error: rejection }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadFile(buffer, `${tenantId}/lankaqr/static-qr`, {
      contentType: file.type,
      folder: 'lankaqr',
      maxSizeBytes: LANKA_QR_IMAGE_MAX_BYTES,
    });

    return NextResponse.json({ success: true, url: result.url });
  } catch (error) {
    // ARGUS #494 policy: log storage detail, return a friendly retry message.
    console.error('POST /api/settings/payments/qr error:', error);
    return NextResponse.json(
      { error: 'Could not upload the QR image. Please try again.' },
      { status: 500 },
    );
  }
}
