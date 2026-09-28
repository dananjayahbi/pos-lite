import 'server-only';

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { isModuleEnabled } from '@/lib/feature-guard';
import { prisma } from '@/lib/prisma';
import type { PermissionKey } from '@/lib/constants/permissions';

// INF-02: the typed error builders live in the canonical modules now; this
// file re-exports them so the delivery route family keeps compiling
// unchanged (back-compat per the INF-02 design).
import { unauthorized, forbidden, badRequest, conflict, notFound, upstreamError } from './error-envelope';
export { unauthorized, forbidden, validationError, notFound, conflict, badRequest, internalError } from './error-envelope';

/**
 * Shared route guards for the delivery feature: auth + tenant + feature-module
 * + permission. Returns the resolved tenantId on success, or a Response to
 * short-circuit on failure. Mirrors the inline guards used across /api/store/*.
 */

export async function requireDeliveryAuth(permission?: PermissionKey): Promise<
  { ok: true; tenantId: string; userId: string } | { ok: false; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, response: unauthorized('Authentication required') };
  }
  const tenantId = session.user.tenantId;
  if (!tenantId) {
    return { ok: false, response: unauthorized('No tenant associated') };
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  if (!isModuleEnabled((tenant?.settings ?? {}) as Record<string, unknown>, 'delivery')) {
    return { ok: false, response: forbidden('Delivery module is not enabled') };
  }

  if (permission && !hasPermission(session.user, permission)) {
    return { ok: false, response: forbidden('Insufficient permissions') };
  }

  return { ok: true, tenantId, userId: session.user.id };
}

/**
 * Map delivery-service sentinel errors (and courier-prefixed errors) to HTTP
 * responses. Returns null when the error is not recognized (caller falls back
 * to a 500). Delivery-specific friendly copy; the generic classification for
 * other routes lives in `map-service-error.ts`.
 */
export function mapDeliveryError(error: unknown): NextResponse | null {
  const message = error instanceof Error ? error.message : '';
  if (message === 'DELIVERY_NOT_FOUND') return notFound('Delivery not found');
  if (message === 'SHIPMENT_NOT_FOUND') return notFound('Shipment not found');
  if (message === 'PACKAGING_ITEM_NOT_FOUND') return notFound('Packaging item not found');
  if (message === 'DELIVERY_NOT_EDITABLE') return badRequest('Delivery can only be edited before dispatch');
  if (message === 'DELIVERY_NOT_DISPATCHABLE') return conflict('Delivery is not in a dispatchable state');
  if (message === 'DELIVERY_NOT_RECOVERABLE') return conflict('Delivery is not in a recoverable state');
  if (message === 'DELIVERY_ALREADY_DISPATCHED') return conflict('Delivery already has an active shipment');
  if (message === 'DELIVERY_MISSING_ADDRESS') return badRequest('Delivery has no shipping address');
  // NEW-F (M24-01): payment-settlement block is a state conflict, not a crash.
  if (message === 'DELIVERY_PAYMENT_NOT_SETTLED') return conflict('Delivery payment has not been settled');

  // M26-02/BUG-66: reconciliation-dispute sentinels. These were unmapped, so
  // routine client errors (unknown id, double-dispute, cross-tenant id) 500'd
  // across five QA pins.
  if (message === 'LEDGER_ENTRY_NOT_FOUND') return notFound('Ledger entry not found');
  if (message === 'DISPUTE_NOT_FOUND') return notFound('Dispute not found');
  if (message === 'ALREADY_DISPUTED') return conflict('This ledger entry already has an open dispute');
  // M26-03: corrupt/unreadable statement file is a client-input error.
  if (message === 'STATEMENT_PARSE_FAILED') return badRequest('Could not parse statement file');

  if (message === 'COURIER_ACCOUNT_NOT_CONFIGURED') return conflict('Save your Trans Express account before syncing locations');
  if (message === 'COURIER_CREDENTIALS_MISSING') return badRequest('Add an email or API key to your Trans Express account before syncing locations');
  // M24-01/OBS-32: upstream-courier failures are infrastructure faults, not
  // client errors. 502 Bad Gateway separates an outage from a bad request so
  // operators/monitors can distinguish them (previously all mapped to 400).
  if (message.startsWith('COURIER_AUTH_FAILED')) return upstreamError('COURIER_AUTH_FAILED', 'Trans Express authentication failed');
  if (message.startsWith('COURIER_UPLOAD_FAILED')) return upstreamError('COURIER_UPLOAD_FAILED', 'Trans Express could not issue the waybill');
  if (message.startsWith('COURIER_TRACKING_FAILED')) return upstreamError('COURIER_TRACKING_FAILED', 'Could not fetch tracking from Trans Express');
  if (message.startsWith('LOCATION_SYNC_FAILED')) return upstreamError('LOCATION_SYNC_FAILED', 'Could not sync locations from Trans Express');
  return null;
}
