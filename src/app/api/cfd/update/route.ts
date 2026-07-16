import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cfdEmitter } from '@/lib/cfdEmitter';
import type { CFDCartPayload } from '@/lib/cfdEmitter';

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'No tenant associated' } },
        { status: 401 },
      );
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } },
        { status: 404 },
      );
    }

    const body = (await request.json()) as Omit<CFDCartPayload, 'tenantSlug'>;

    const payload: CFDCartPayload = {
      ...body,
      tenantSlug: tenant.slug,
    };

    cfdEmitter.emit(`cfd-update-${tenant.slug}`, payload);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update CFD' } },
      { status: 500 },
    );
  }
}
