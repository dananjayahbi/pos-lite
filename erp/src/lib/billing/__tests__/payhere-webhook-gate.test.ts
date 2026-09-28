/**
 * M30-03 / BUG-72 — the webhook's write-gate invariant, proven without a DB.
 *
 * The route used to record the `InvoicePaymentEvent` audit row BEFORE the
 * signature check, so any forged IPN that guessed a real invoice id left a row
 * in the financial ledger. This test drives the real route handler with a
 * mocked Prisma client and asserts that a rejected IPN never touches the
 * database AT ALL — no invoice lookup, no audit write — while a verified one
 * still does (so the assertion is not vacuously green).
 *
 * Lives beside the signature-module tests in `src/lib/billing/__tests__/`
 * because it exercises billing behaviour; `tests/30_payments_billing.spec.ts`
 * A1 pins the same invariant against the live DB.
 */

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invoiceFindUnique: vi.fn(),
  paymentEventCreate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    invoice: { findUnique: mocks.invoiceFindUnique },
    invoicePaymentEvent: { create: mocks.paymentEventCreate },
  },
}));

import { POST } from '@/app/api/webhooks/payhere/route';
import {
  computeCheckoutHash,
  computeIpnSignature,
  resetSecretWarningThrottle,
} from '@/lib/payments/payhere-crypto';

const SECRET = 'qa-secret-abc';
const ORIGINAL_SECRET = process.env.PAYHERE_MERCHANT_SECRET;

const IPN = {
  merchant_id: '123456',
  order_id: 'cmreal_invoice_id',
  payhere_amount: '1000.00',
  payhere_currency: 'LKR',
  status_code: '2',
  recurring: '',
  message_type: '',
};

function ipnRequest(md5sig: string): NextRequest {
  const body = new URLSearchParams({ ...IPN, md5sig }).toString();
  return new NextRequest('http://localhost/api/webhooks/payhere', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  });
}

/** The camelCase shape `computeIpnSignature` expects. The IPN digest INCLUDES
 *  `status_code` — omitting it (as the route once did) rejects every genuine
 *  notification, so the tests below would all fail on a wrong formula. */
const SIG_PAYLOAD = {
  merchantId: IPN.merchant_id,
  orderId: IPN.order_id,
  amount: IPN.payhere_amount,
  currency: IPN.payhere_currency,
  statusCode: IPN.status_code,
};

function setSecret(value: string | undefined): void {
  if (value === undefined) delete process.env.PAYHERE_MERCHANT_SECRET;
  else process.env.PAYHERE_MERCHANT_SECRET = value;
}

beforeEach(() => {
  // Keep the expected/rejected warnings out of the test output.
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  resetSecretWarningThrottle();
  mocks.invoiceFindUnique.mockResolvedValue(null);
  mocks.paymentEventCreate.mockResolvedValue({});
});

afterEach(() => {
  setSecret(ORIGINAL_SECRET);
  resetSecretWarningThrottle();
  vi.restoreAllMocks();
});

describe('POST /api/webhooks/payhere — signature gate runs before any DB access', () => {
  it('a forged IPN performs NO invoice lookup and creates NO payment event', async () => {
    setSecret(SECRET);

    const res = await POST(ipnRequest('forged-signature'));

    expect(res.status).toBe(200); // PayHere retry semantics unchanged
    expect(await res.json()).toEqual({
      received: false,
      signatureValid: false,
      reason: 'BAD_SIGNATURE',
    });
    expect(mocks.invoiceFindUnique).not.toHaveBeenCalled();
    expect(mocks.paymentEventCreate).not.toHaveBeenCalled();
  });

  it('an IPN rejected for a missing secret also performs NO DB access', async () => {
    setSecret(undefined);

    const res = await POST(ipnRequest('anything'));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      received: false,
      signatureValid: false,
      reason: 'SECRET_NOT_CONFIGURED',
    });
    expect(mocks.invoiceFindUnique).not.toHaveBeenCalled();
    expect(mocks.paymentEventCreate).not.toHaveBeenCalled();
  });

  it('never accepts the empty-secret hash an unset secret would expect', async () => {
    setSecret(undefined);
    const emptySecretSig = computeIpnSignature('', SIG_PAYLOAD);

    const res = await POST(ipnRequest(emptySecretSig));

    expect((await res.json()).reason).toBe('SECRET_NOT_CONFIGURED');
    expect(mocks.paymentEventCreate).not.toHaveBeenCalled();
  });

  it('a verified IPN DOES reach the DB (non-vacuity guard)', async () => {
    setSecret(SECRET);
    const validSig = computeIpnSignature(SECRET, SIG_PAYLOAD);

    const res = await POST(ipnRequest(validSig));

    expect(res.status).toBe(200);
    // Accepted response keeps the original shape — rejection fields are additive
    // on the rejected path only.
    expect(await res.json()).toEqual({ received: true });
    // No invoice exists in this mock, so no audit row is written; the point is
    // that the gate let the request through to the lookup.
    expect(mocks.invoiceFindUnique).toHaveBeenCalledTimes(1);
  });

  it('a verified IPN for an existing invoice writes exactly one audit event', async () => {
    setSecret(SECRET);
    mocks.invoiceFindUnique.mockResolvedValue({
      id: IPN.order_id,
      status: 'PENDING',
      subscriptionId: 'sub_1',
      tenantId: 'tenant_1',
    });
    const validSig = computeIpnSignature(SECRET, SIG_PAYLOAD);

    await POST(ipnRequest(validSig));

    expect(mocks.paymentEventCreate).toHaveBeenCalledTimes(1);
    expect(mocks.paymentEventCreate.mock.calls[0]?.[0]).toMatchObject({
      data: {
        invoiceId: IPN.order_id,
        payhereMd5sig: validSig,
        signatureValid: true,
      },
    });
  });

  it('rejects the CHECKOUT-hash shape (the signature this route used to accept)', async () => {
    // Regression pin: the old gate computed md5(...currency + md5(secret)) with
    // no status_code, so a notification signed that way verified. Real PayHere
    // signatures never look like this, which is why no payment ever confirmed.
    setSecret(SECRET);
    const checkoutShaped = computeCheckoutHash(SECRET, {
      merchantId: IPN.merchant_id,
      orderId: IPN.order_id,
      amount: IPN.payhere_amount,
      currency: IPN.payhere_currency,
    });

    const res = await POST(ipnRequest(checkoutShaped));

    expect((await res.json()).reason).toBe('BAD_SIGNATURE');
    expect(mocks.invoiceFindUnique).not.toHaveBeenCalled();
  });
});