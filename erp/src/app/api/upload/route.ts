import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { uploadFile } from '@/lib/storage';
import { createThumbnail } from '@/lib/image-thumbnail';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    );
  }

  const formData = await req.formData();
  const file = formData.get('image');

  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: 'No image file provided' },
      { status: 400 },
    );
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: 'Only JPEG, PNG, and WebP images are accepted.' },
      { status: 400 },
    );
  }

  const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: 'Image must be under 5 MB.' },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const path = `${session.user.tenantId}/variants/${Date.now()}`;
    const result = await uploadFile(buffer, path, {
      contentType: file.type,
      folder: 'variant-images',
      maxSizeBytes: MAX_SIZE,
    });

    // Feature update #14: store a second, 256x256 WebP version for icon-size
    // surfaces (POS grid, inventory rows, pickers). A thumbnail failure must
    // not lose the already-uploaded full image, so it degrades to `null` and
    // consumers fall back to the full URL.
    let thumbnailUrl: string | null = null;
    try {
      const thumbnail = await createThumbnail(buffer);
      const thumbResult = await uploadFile(thumbnail, `${path}-thumb`, {
        contentType: 'image/webp',
        folder: 'variant-images',
        maxSizeBytes: MAX_SIZE,
      });
      thumbnailUrl = thumbResult.url;
    } catch (thumbnailError) {
      console.warn('[POST /api/upload] thumbnail generation failed:', thumbnailError);
    }

    return NextResponse.json({ url: result.url, thumbnailUrl });
  } catch (error) {
    console.error('Upload error:', error);
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
