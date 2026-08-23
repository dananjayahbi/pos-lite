import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { uploadFile } from '@/lib/storage';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB for expense receipts

/**
 * Upload an expense receipt image. Mirrors the category-image/brand-logo upload
 * routes but stores files under an expense-receipts folder so attached receipt
 * evidence can be referenced by the Expense record (doc 38).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    );
  }

  const formData = await req.formData();
  const file = formData.get('file');

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Only JPEG, PNG, and WebP images are accepted.' },
      { status: 400 },
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: 'Image must be under 5 MB.' },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const path = `${session.user.tenantId}/expenses/receipt`;

    const result = await uploadFile(buffer, path, {
      contentType: file.type,
      folder: 'expense-receipts',
      maxSizeBytes: MAX_SIZE,
    });

    return NextResponse.json({ url: result.url });
  } catch (error) {
    console.error('Receipt upload error:', error);
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
