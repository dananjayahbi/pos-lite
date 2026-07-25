import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        },
        { status: 401 },
      );
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'No tenant associated' },
        },
        { status: 401 },
      );
    }

    const categories = await prisma.category.findMany({
      where: { tenantId },
      select: { id: true, name: true, description: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ success: true, data: { categories } });
  } catch (error) {
    console.error('GET /api/store/website/categories error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
        },
      },
      { status: 500 },
    );
  }
}
