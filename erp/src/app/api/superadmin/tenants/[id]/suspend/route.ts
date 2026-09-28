import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/api/superadmin-guard';
import { toErrorResponse } from '@/lib/api/error-envelope';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireSuperAdmin();
    if (!guard.ok) return guard.response;

    const { id } = await params;

    // M08-02 (BUG-36): explicit existence check → typed 404 envelope instead
    // of an unhandled P2025 500. Wording matches the settings sibling route.
    const existing = await prisma.tenant.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Business not found' } },
        { status: 404 },
      );
    }

    const tenant = await prisma.tenant.update({
      where: { id },
      data: { status: 'SUSPENDED' },
    });

    return NextResponse.json({ tenant });
  } catch (error) {
    return toErrorResponse(error, 'POST /api/superadmin/tenants/[id]/suspend');
  }
}
