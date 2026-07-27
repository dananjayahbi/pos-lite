/**
 * Internal Middleware Data API (Node.js Runtime)
 *
 * Vercel middleware runs on Edge Runtime, which cannot use Prisma or other
 * Node.js modules. This API route acts as a bridge — middleware calls this
 * endpoint via fetch() for any database operations it needs.
 *
 * IMPORTANT: This route must be excluded from the middleware matcher to
 * prevent infinite loops. See middleware.ts → config.matcher.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AUTH_ACTIONS, createAuditLog } from '@/lib/services/audit.service';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'checkSessionVersion': {
        const { userId } = body;
        if (!userId || typeof userId !== 'string') {
          return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });
        }
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { sessionVersion: true },
        });
        return NextResponse.json({ sessionVersion: user?.sessionVersion ?? null });
      }

      case 'checkTenantStatus': {
        const { tenantId } = body;
        if (!tenantId || typeof tenantId !== 'string') {
          return NextResponse.json({ error: 'Invalid tenantId' }, { status: 400 });
        }
        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: {
            id: true,
            status: true,
            deletedAt: true,
          },
        });
        return NextResponse.json(tenant);
      }

      case 'checkTenantSlug': {
        const { slug } = body;
        if (!slug || typeof slug !== 'string') {
          return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
        }
        const tenant = await prisma.tenant.findFirst({
          where: { slug },
          select: { id: true },
        });
        return NextResponse.json({ exists: tenant !== null });
      }

      case 'createAuditLog': {
        const {
          tenantId,
          actorId,
          actorRole,
          entityType,
          entityId,
          auditAction,
          ipAddress,
          userAgent,
        } = body;
        await createAuditLog({
          tenantId: tenantId ?? null,
          actorId: actorId ?? null,
          actorRole: actorRole ?? 'UNKNOWN',
          entityType: entityType ?? 'Unknown',
          entityId: entityId ?? 'unknown',
          action: auditAction ?? AUTH_ACTIONS.SESSION_INVALIDATED_BY_VERSION_MISMATCH,
          ipAddress: ipAddress ?? 'unknown',
          userAgent: userAgent ?? undefined,
        });
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('Middleware API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
