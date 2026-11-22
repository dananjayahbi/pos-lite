/**
 * ARGUS #301 - the waybill sender must be the audited business, not a stale
 * value saved in the label designer.
 *
 * Source of truth: `Tenant.name`, `Tenant.settings.phoneNumber` and
 * `Tenant.settings.address` (the Store Profile). No fallback value is invented;
 * missing fields are returned so the UI can show exactly what is unconfigured.
 */
import type { DeliveryLabelTemplate } from '@/types/delivery-label';

export interface BusinessSenderSource {
  name?: string | null | undefined;
  contact?: string | null | undefined;
  pickupAddress?: string | null | undefined;
}

export interface ResolvedWaybillSender {
  name: string;
  contact: string;
  pickupAddress: string;
  /** Human-readable fields that are not configured. */
  missing: string[];
}

export interface WaybillSenderDecision {
  /** The "From"/"Contact" rows can be printed without a dash placeholder. */
  canPrint: boolean;
  missing: string[];
  reason: string | null;
}

function text(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function resolveWaybillSender(source: BusinessSenderSource): ResolvedWaybillSender {
  const name = text(source.name);
  const contact = text(source.contact);
  const pickupAddress = text(source.pickupAddress);

  const missing: string[] = [];
  if (!name) missing.push('Sender name');
  if (!contact) missing.push('Sender contact');
  if (!pickupAddress) missing.push('Pickup address');

  return { name, contact, pickupAddress, missing };
}

/**
 * Sender fields needed for a readable waybill are the name and contact. A
 * missing pickup address is surfaced as a warning but does not block printing,
 * because the requirement is to include it "when available" without inventing
 * an address.
 */
export function waybillSenderDecision(
  sender: BusinessSenderSource | ResolvedWaybillSender | DeliveryLabelTemplate,
): WaybillSenderDecision {
  const resolved = resolveWaybillSender({
    name: 'brandName' in sender ? sender.brandName : sender.name,
    contact: 'fromContact' in sender ? sender.fromContact : sender.contact,
    pickupAddress:
      'pickupAddress' in sender ? sender.pickupAddress : undefined,
  });
  const canPrint = Boolean(resolved.name && resolved.contact);
  return {
    canPrint,
    missing: resolved.missing,
    reason:
      resolved.missing.length > 0
        ? `Missing sender details: ${resolved.missing.join(', ')}`
        : null,
  };
}
