import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';

export async function GET() {
  const startTime = performance.now();

  try {
    await prisma.$queryRaw(Prisma.sql`SELECT 1`);
    const latency = Math.round(performance.now() - startTime);

    return NextResponse.json(
      { status: 'ok', latency, timestamp: new Date().toISOString() },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { status: 'error', message: 'Database unavailable' },
      { status: 503 },
    );
  }
}
