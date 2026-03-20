import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSaleById } from '@/lib/services/sale.service';
import { sendWhatsAppReceiptMessage } from '@/lib/whatsapp';
import { formatRupee } from '@/lib/format';
import { createAuditLog } from '@/lib/services/audit.service';

const bodySchema = z.object({
  phoneNumber: z.string().min(7).max(20),
});

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
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

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid phone number' } },
        { status: 400 },
      );
    }

    const { id } = await props.params;

    let sale;
    try {
      sale = await getSaleById(tenantId, id);
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Sale not found' } },
        { status: 404 },
      );
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, settings: true },
    });

    const storeName = tenant?.name ?? 'Store';
    const saleReference = sale.id.slice(0, 8).toUpperCase();
    const itemsSummary = sale.lines
      .slice(0, 3)
      .map((l) => l.productNameSnapshot)
      .join(', ');
    const totalAmount = formatRupee(Number(sale.totalAmount));

    const result = await sendWhatsAppReceiptMessage(parsed.data.phoneNumber, sale.id, {
      storeName,
      saleReference,
      itemsSummary,
      totalAmount,
    });

    if (result.success) {
      await prisma.sale.update({
        where: { id: sale.id },
        data: { whatsappReceiptSentAt: new Date() },
      });
      return NextResponse.json({ success: true });
    }

    // Log failure in production
    if (process.env.NODE_ENV === 'production') {
      try {
        await createAuditLog({
          tenantId,
          actorId: session.user.id ?? null,
          actorRole: session.user.role ?? 'CASHIER',
          entityType: 'Sale',
          entityId: sale.id,
          action: 'WHATSAPP_RECEIPT_FAILED',
          after: { phoneNumber: parsed.data.phoneNumber, error: result.error },
        });
      } catch {
        // Swallow audit log errors
      }
    }

    return NextResponse.json({
      success: false,
      error: { code: 'WHATSAPP_FAILED', message: result.error ?? 'WhatsApp dispatch failed' },
    });
  } catch (error) {
    console.error('POST /api/store/sales/[id]/send-receipt error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
