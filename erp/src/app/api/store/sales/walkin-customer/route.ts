import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { createCustomer } from '@/lib/services/customer.service';
import { zSriLankaPhone } from '@/lib/validators/shared';

/**
 * Walk-in customer creation for the POS (doc 32).
 *
 * Finalizing a POS sale requires a linked customer with a name and mobile. This
 * endpoint lets a cashier capture those two fields inline without the full CRM
 * form. It is gated on the ability to create a sale (the POS checkout context),
 * not on the CRM customer-creation permission.
 *
 * M14-03 (req 2.2): this route builds its OWN input schema and calls the
 * customer service directly, so it does NOT inherit `CreateCustomerSchema`'s
 * phone contract. It must therefore apply `zSriLankaPhone` explicitly — the
 * same SL-format + +94-normalization the CRM uses — or the POS capture point
 * (the exact surface req 2.2 targets) stays length-only.
 */
const WalkInSchema = z.object({
  name: z.string().trim().min(1, 'Customer name is required'),
  phone: zSriLankaPhone({
    message: 'A valid Sri Lankan mobile number is required (+94XXXXXXXXX or 0XXXXXXXXX)',
  }),
});

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

    if (!hasPermission(session.user, PERMISSIONS.SALE.createSale)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = WalkInSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid walk-in customer details';
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message } },
        { status: 400 },
      );
    }

    const customer = await createCustomer(tenantId, {
      name: parsed.data.name,
      phone: parsed.data.phone,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        creditBalance: '0',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create walk-in customer';
    return NextResponse.json(
      { success: false, error: { code: 'CUSTOMER_CREATE_FAILED', message } },
      { status: 409 },
    );
  }
}
