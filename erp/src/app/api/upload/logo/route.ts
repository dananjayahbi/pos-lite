import { NextRequest, NextResponse } from 'next/server';
import { uploadFile } from '@/lib/storage';
import { requireSuperAdmin } from '@/lib/api/superadmin-guard';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB for logos

export async function POST(req: NextRequest) {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return guard.response;

  const formData = await req.formData();
  const file = formData.get('file');
  const tenantId = formData.get('tenantId');

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (!tenantId || typeof tenantId !== 'string') {
    return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Only JPEG, PNG, WebP, and SVG images are accepted.' },
      { status: 400 },
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: 'Logo must be under 2 MB.' },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split('.').pop() ?? 'png';
    const path = `${tenantId}/logo/logo`;

    const result = await uploadFile(buffer, path, {
      contentType: file.type,
      folder: 'business-logos',
      maxSizeBytes: MAX_SIZE,
    });

    return NextResponse.json({ url: result.url });
  } catch (error) {
    console.error('Logo upload error:', error);
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
