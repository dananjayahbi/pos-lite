import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { hasPermission } from '@/lib/utils/permissions';
import { getSaleById } from '@/lib/services/sale.service';
import { sendWhatsAppReceiptMessage } from '@/lib/whatsapp';
import { formatRupee } from '@/lib/format';
import { createAuditLog } from '@/lib/services/audit.service';
import { providerErrorCode } from '@/lib/notifications/provider-status';

// M31-02 (OBS-55): this route could previously be used by ANY authenticated
// role to WhatsApp an arbitrary attacker-supplied phone number. The phone must
// now belong to the sale's customer, and an arbitrary override requires the
// dedicated receipt-send permission — EXCEPT when a cashier is re-sending the
// receipt for their OWN sale, which stays allowed (their legitimate flow).

const bodySchema = z.object({
  phoneNumber: z.string().min(7).max(20),
});

/** Normalises a Sri Lankan phone number to its bare digit form for comparison. */
function normalisePhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('94') && digits.length === 11) return '0' + digits.slice(2);
  return digits;
}

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

    // ── Authorization (M31-02 / OBS-55) ──────────────────────────────────────
    // The requested number must belong to the sale's customer. Sending to any
    // other number is an override that requires the receipt-send permission.
    const saleCustomer = sale.customerId
      ? await prisma.customer.findFirst({
          where: { id: sale.customerId, tenantId },
          select: { phone: true },
        })
      : null;

    const requestedPhone = normalisePhone(parsed.data.phoneNumber);
    const customerPhone = saleCustomer?.phone ? normalisePhone(saleCustomer.phone) : null;
    const isCustomerPhone = customerPhone !== null && customerPhone === requestedPhone;

    const canOverride = hasPermission(session.user, PERMISSIONS.SALE.sendReceipt);
    const isOwnSale = sale.cashier?.id === session.user.id;

    if (!isCustomerPhone && !canOverride) {
      // A cashier may still re-send for their own sale — but only to that
      // sale's customer number (already excluded above), so this is a 403.
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: isOwnSale
              ? 'Receipt can only be sent to this sale customer\u2019s phone number'
              : 'Insufficient permissions to send a receipt to an arbitrary number',
          },
        },
        { status: 403 },
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
      error: {
        // M31-01 (BUG-73): distinguish "provider not configured" from a real
        // provider rejection so the UI can tell the operator what to fix.
        code: providerErrorCode('whatsapp', result.error),
        message: result.error ?? 'WhatsApp dispatch failed',
      },
    });
  } catch (error) {
    console.error('POST /api/store/sales/[id]/send-receipt error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
