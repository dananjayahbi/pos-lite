import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { getProviderConfigStatus } from '@/lib/notifications/provider-status';
import { getBridgeAuthStatus } from '@/lib/internal-bridge-auth';

export async function GET() {
  const startTime = performance.now();

  try {
    await prisma.$queryRaw(Prisma.sql`SELECT 1`);
    const latency = Math.round(performance.now() - startTime);

    // M31-01 (BUG-73): the integrations matrix INF-03 asked for. A deployment
    // with missing credentials used to look perfectly healthy while every
    // email/WhatsApp send silently failed — this makes that visible to any
    // uptime check.
    const providers = getProviderConfigStatus();

    return NextResponse.json(
      {
        status: 'ok',
        latency,
        timestamp: new Date().toISOString(),
        integrations: {
          email: { configured: providers.email },
          whatsapp: { configured: providers.whatsapp },
          payhere: { configured: Boolean(process.env.PAYHERE_MERCHANT_SECRET) },
        },
        // M35-02 hardening: whether the Edge→Node bridge requires a shared
        // secret. 'enforced' is the intended state; anything else means the
        // bridge is unauthenticated (allowed only outside production).
        internalBridge: { auth: getBridgeAuthStatus() },
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { status: 'error', message: 'Database unavailable' },
      { status: 503 },
    );
  }
}
