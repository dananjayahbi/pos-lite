import { ImageResponse } from 'next/og';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default async function Icon() {
  let initial = 'V';

  try {
    const tenant = await prisma.tenant.findFirst({
      where: { deletedAt: null, status: 'ACTIVE' },
      select: { name: true },
      orderBy: { createdAt: 'asc' },
    });

    if (tenant?.name) {
      initial = tenant.name.charAt(0).toUpperCase();
    }
  } catch {
    // fallback to 'V'
  }

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 24,
          background: '#3B2A1F',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#F5F0EB',
          borderRadius: 6,
          fontFamily: 'system-ui, sans-serif',
          fontWeight: 700,
        }}
      >
        {initial}
      </div>
    ),
    { ...size },
  );
}
