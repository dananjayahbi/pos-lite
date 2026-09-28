/**
 * PayHere checkout payload builders.
 *
 * Both PayHere flows (hosted redirect and onsite JS SDK) consume the SAME field
 * set — only the transport differs — so both are built here from one shape.
 * The `hash` is always computed server-side (a browser-side hash would leak the
 * merchant secret); the HTTP layer only ever forwards the finished fields.
 *
 * See `REFERENCES/payhere/PAYHERE-INTEGRATION.md` §2 for the field contract.
 */

import { computeCheckoutHash, formatPayhereAmount } from "./payhere-crypto";
import {
  getPayhereCheckoutUrl,
  getPayhereMerchantId,
  getPayhereSdkUrl,
} from "./payhere-config";

/** PayHere's `currency` values we support. */
export type PayhereCurrency = "LKR" | "USD";

/** A single optional line item (`item_name_1`, `amount_1`, …). */
export interface PayhereLineItem {
  name: string;
  /** Unit price; two decimals are applied. */
  amount: number | string;
  quantity: number;
  /** Optional model/code (`item_number_n`). */
  number?: string;
}

/** Customer details PayHere requires. `email`/`phone` MUST be valid. */
export interface PayhereCustomer {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  /** Defaults to "Sri Lanka". */
  country?: string;
}

export interface PayhereCheckoutInput {
  /** Merchant-side order id (we use the `Delivery` id). Must be unique. */
  orderId: string;
  /** Human title shown on the gateway (order number / invoice number). */
  items: string;
  amount: number | string;
  currency?: PayhereCurrency;
  customer: PayhereCustomer;
  /** Absolute URL the browser returns to after an approved payment. */
  returnUrl: string;
  /** Absolute URL the browser returns to when the customer cancels. */
  cancelUrl: string;
  /** Absolute, publicly reachable URL for the server-to-server callback. */
  notifyUrl: string;
  /** Optional separate delivery address. */
  delivery?: { address?: string; city?: string; country?: string };
  /** Optional per-line items. */
  lines?: PayhereLineItem[];
  /** Merchant routing payloads, echoed back on the IPN (max ~2 documented). */
  custom?: { custom1?: string; custom2?: string };
  /**
   * Pre-select a payment method, bypassing the gateway's own chooser. Leave
   * undefined to let the customer pick (this also exposes gateway-side methods
   * such as wallets that are not ours to enumerate).
   */
  paymentMethod?: string;
}

/** Max line items later `item_name_n` fields are built for. */
const MAX_LINE_ITEMS = 20;

/**
 * Split a full name into PayHere's `first_name` / `last_name`. PayHere
 * requires both; we keep the surname with the last token so multi-word names
 * (common in Sri Lanka) survive sensibly.
 */
export function splitFullName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "-" };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1]!,
  };
}

/**
 * Normalise a Sri Lankan phone number to the digits-and-leading-zero form
 * PayHere accepts (`0771234567`). Spaces, dashes, parentheses and a `+94`
 * country prefix are tolerated because the checkout form allows them.
 */
export function normalisePhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+94")) return `0${digits.slice(3)}`;
  if (digits.startsWith("94") && digits.length > 10) return `0${digits.slice(2)}`;
  return digits.replace(/^\+/, "");
}

/**
 * Trim and clamp a value to PayHere's practical limits. PayHere answers
 * "Something Went Wrong" for oversized or unsupported content, so every
 * customer-supplied value passes through here before it reaches the gateway.
 */
function sanitize(value: string, maxLength: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

/**
 * Build the complete hidden-field set for a PayHere checkout (redirect form or
 * JS SDK). Throws when the merchant credentials are missing — a payload without
 * a `hash` would be rejected by PayHere, so failing here is clearer than a
 * confusing gateway error page.
 */
export function buildPayhereCheckoutFields(
  input: PayhereCheckoutInput,
  merchantSecret: string,
): Record<string, string> {
  const merchantId = getPayhereMerchantId();
  if (!merchantId) {
    throw new Error(
      "PAYHERE_MERCHANT_ID is not configured — cannot build a checkout payload",
    );
  }

  const currency: PayhereCurrency = input.currency ?? "LKR";
  const amount = formatPayhereAmount(input.amount);

  const fields: Record<string, string> = {
    merchant_id: merchantId,
    return_url: input.returnUrl,
    cancel_url: input.cancelUrl,
    notify_url: input.notifyUrl,
    order_id: input.orderId,
    items: sanitize(input.items, 100),
    currency,
    amount,
    first_name: sanitize(input.customer.firstName, 50),
    last_name: sanitize(input.customer.lastName, 50),
    email: sanitize(input.customer.email, 100),
    phone: sanitize(normalisePhone(input.customer.phone), 20),
    address: sanitize(input.customer.address, 100),
    city: sanitize(input.customer.city, 50),
    country: sanitize(input.customer.country ?? "Sri Lanka", 50),
  };

  if (input.delivery?.address) {
    fields.delivery_address = sanitize(input.delivery.address, 100);
  }
  if (input.delivery?.city) {
    fields.delivery_city = sanitize(input.delivery.city, 50);
  }
  if (input.delivery?.country) {
    fields.delivery_country = sanitize(input.delivery.country, 50);
  }

  // Per-line items, numbered from 1 (PayHere's documented convention).
  input.lines?.slice(0, MAX_LINE_ITEMS).forEach((line, index) => {
    const n = index + 1;
    fields[`item_name_${n}`] = sanitize(line.name, 100);
    fields[`amount_${n}`] = formatPayhereAmount(line.amount);
    fields[`quantity_${n}`] = String(line.quantity);
    if (line.number) fields[`item_number_${n}`] = sanitize(line.number, 50);
  });

  if (input.custom?.custom1) fields.custom_1 = sanitize(input.custom.custom1, 100);
  if (input.custom?.custom2) fields.custom_2 = sanitize(input.custom.custom2, 100);
  if (input.paymentMethod) fields.payment_method = input.paymentMethod;

  // The hash covers exactly the values submitted, so it is computed last.
  fields.hash = computeCheckoutHash(merchantSecret, {
    merchantId,
    orderId: input.orderId,
    amount,
    currency,
  });

  return fields;
}

/** The redirect-form payload: gateway URL + hidden fields for an auto-submit. */
export interface PayhereRedirectPayload {
  payhereUrl: string;
  payload: Record<string, string>;
}

/** Build the redirect-checkout payload (hosted PayHere page). */
export function buildPayhereRedirect(
  input: PayhereCheckoutInput,
  merchantSecret: string,
): PayhereRedirectPayload {
  return {
    payhereUrl: getPayhereCheckoutUrl(),
    payload: buildPayhereCheckoutFields(input, merchantSecret),
  };
}

/**
 * The onsite (JS SDK) payload. The SDK shows PayHere inside an iframe on our
 * own page instead of redirecting away.
 */
export interface PayhereOnsitePayload {
  sdkUrl: string;
  payload: Record<string, string>;
}

export function buildPayhereOnsite(
  input: PayhereCheckoutInput,
  merchantSecret: string,
): PayhereOnsitePayload {
  return {
    sdkUrl: getPayhereSdkUrl(),
    payload: buildPayhereCheckoutFields(input, merchantSecret),
  };
}
