import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { uploadFile } from '@/lib/storage';

/**
 * Website asset upload endpoint — supports images and videos.
 * Uploads to Cloudflare R2 under the tenant's website-assets folder.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: 'Invalid form data' },
      { status: 400 },
    );
  }

  const file = formData.get('file');

  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: 'No file provided. Use field name "file".' },
      { status: 400 },
    );
  }

  // Determine asset type from MIME
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');

  if (!isImage && !isVideo) {
    return NextResponse.json(
      { error: 'Only image and video files are accepted.' },
      { status: 400 },
    );
  }

  // Size limits based on type
  const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
  const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB

  const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
  if (file.size > maxSize) {
    const limitMB = isVideo ? 100 : 10;
    return NextResponse.json(
      { error: `${isVideo ? 'Video' : 'Image'} must be under ${limitMB} MB.` },
      { status: 400 },
    );
  }

  // Validate image types
  if (isImage) {
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif'];
    if (!allowedImageTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Only JPEG, PNG, WebP, SVG, and GIF images are accepted.' },
        { status: 400 },
      );
    }
  }

  // Validate video types
  if (isVideo) {
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
    if (!allowedVideoTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Only MP4, WebM, MOV, and AVI videos are accepted.' },
        { status: 400 },
      );
    }
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const assetType = isVideo ? 'videos' : 'images';
    const path = `${session.user.tenantId}/website/${assetType}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    const result = await uploadFile(buffer, path, {
      contentType: file.type,
      folder: `website-${assetType}`,
      maxSizeBytes: maxSize,
    });

    return NextResponse.json({ url: result.url });
  } catch (error) {
    console.error('Website asset upload error:', error);
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
