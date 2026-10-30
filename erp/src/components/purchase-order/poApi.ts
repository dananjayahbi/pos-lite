/**
 * Transport helpers for the purchase-order endpoints.
 *
 * Every route answers with the `{ success, data, error }` envelope, so one
 * helper unwraps it and turns a failed response into an `Error` carrying the
 * server's own wording (validation messages, "reference already in use", …).
 */

import type {
  POPaymentsResponse,
  PaymentAccountListResponse,
  PurchaseOrderListResponse,
  RecordPaymentPayload,
  RecordPaymentResult,
  UpdatePurchaseOrderPayload,
} from './poTypes';

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: { code?: string; message?: string };
}

async function readEnvelope<T>(response: Response): Promise<T> {
  let json: Envelope<T> | null = null;
  try {
    json = (await response.json()) as Envelope<T>;
  } catch {
    json = null;
  }

  if (!response.ok || !json?.success) {
    throw new Error(json?.error?.message ?? `Request failed (${response.status})`);
  }
  if (json.data === undefined) {
    throw new Error('The server returned no data');
  }
  return json.data;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  return readEnvelope<T>(response);
}

async function sendJson<T>(
  url: string,
  method: 'POST' | 'PATCH',
  body?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return readEnvelope<T>(response);
}

export function fetchPurchaseOrderList(limit = 200): Promise<PurchaseOrderListResponse> {
  return getJson<PurchaseOrderListResponse>(`/api/store/purchase-orders?limit=${limit}`);
}

export function fetchPaymentAccountList(): Promise<PaymentAccountListResponse> {
  return getJson<PaymentAccountListResponse>('/api/store/payment-accounts');
}

export function fetchPurchaseOrderPayments(poId: string): Promise<POPaymentsResponse> {
  return getJson<POPaymentsResponse>(`/api/store/purchase-orders/${poId}/payments`);
}

export function recordPurchaseOrderPayment(
  poId: string,
  payload: RecordPaymentPayload,
): Promise<RecordPaymentResult> {
  return sendJson<RecordPaymentResult>(
    `/api/store/purchase-orders/${poId}/payments`,
    'POST',
    payload,
  );
}

/** The dedicated cancel endpoint (not the status transition on PATCH). */
export function cancelPurchaseOrder(poId: string): Promise<{ id: string; status: string }> {  return sendJson<{ id: string; status: string }>(
    `/api/store/purchase-orders/${poId}/cancel`,
    'POST',
  );
}

/**
 * Amend an existing purchase order.
 *
 * `PATCH /purchase-orders/:id` treats a body containing ONLY `status` as the
 * send/cancel transition and anything else as a field edit, so this must never
 * send `status`.
 */
export function updatePurchaseOrder(
  poId: string,
  payload: UpdatePurchaseOrderPayload,
): Promise<{ id: string; referenceNo: string; totalAmount: string | number }> {
  return sendJson<{ id: string; referenceNo: string; totalAmount: string | number }>(
    `/api/store/purchase-orders/${poId}`,
    'PATCH',
    payload,
  );
}
