import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const businessSettingsSchema = z.object({
  storeName: z.string().trim().min(2, 'Store name must be at least 2 characters').max(80),
  logoUrl: z.string().trim().url('Logo URL must be a valid URL').or(z.literal('')),
  address: z.string().trim().max(160, 'Address must be 160 characters or less'),
  phoneNumber: z.string().trim().max(40, 'Phone number must be 40 characters or less'),
  receiptFooter: z.string().trim().max(240, 'Receipt footer must be 240 characters or less'),
  currency: z.string().trim().min(1, 'Currency is required'),
  timezone: z.string().trim().min(1, 'Timezone is required'),
  vatRate: z.coerce.number().min(0).max(100),
  ssclRate: z.coerce.number().min(0).max(100),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Super admin access required' } },
        { status: 403 },
      );
    }

    const { id } = await params;
    const body: unknown = await request.json();
    const parsed = businessSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      select: { settings: true },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Business not found' } },
        { status: 404 },
      );
    }

    const currentSettings = typeof tenant.settings === 'object' && tenant.settings !== null
      ? (tenant.settings as Record<string, unknown>)
      : {};

    const updatedSettings = {
      ...currentSettings,
      address: parsed.data.address,
      phoneNumber: parsed.data.phoneNumber,
      receiptFooter: parsed.data.receiptFooter,
      currency: parsed.data.currency,
      timezone: parsed.data.timezone,
      vatRate: parsed.data.vatRate,
      ssclRate: parsed.data.ssclRate,
    };

    const updated = await prisma.tenant.update({
      where: { id },
      data: {
        name: parsed.data.storeName,
        logoUrl: parsed.data.logoUrl || null,
        settings: updatedSettings,
      },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        settings: true,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save business settings';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 },
    );
  }
}
