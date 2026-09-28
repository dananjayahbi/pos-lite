/**
 * PayHere gateway configuration — one source of truth for hosts, credentials
 * and the "is it wired up?" question.
 *
 * Every URL is derived here so a sandbox↔live switch is a single env change,
 * and so no call site has to remember PayHere's two host rules:
 *   1. the **live** checkout host must include `www` (otherwise PH-0022);
 *   2. the JS SDK is served from `/lib/payhere.js`, the redirect action from
 *      `/pay/checkout` — different paths on the same host.
 *
 * Deliberately dependency-free so it can be imported by routes, services and
 * unit tests alike.
 */

export type PayhereMode = "sandbox" | "live";

/** Sandbox vs live. Anything other than "true" is treated as live, matching
 *  the historic `PAYHERE_SANDBOX === "true"` check at the call sites. */
export function getPayhereMode(): PayhereMode {
  return process.env.PAYHERE_SANDBOX === "true" ? "sandbox" : "live";
}

export function isSandbox(): boolean {
  return getPayhereMode() === "sandbox";
}

/** Origin of the gateway for the active mode. */
export function getPayhereOrigin(): string {
  return isSandbox() ? "https://sandbox.payhere.lk" : "https://www.payhere.lk";
}

/** Form action for the redirect checkout. */
export function getPayhereCheckoutUrl(): string {
  return `${getPayhereOrigin()}/pay/checkout`;
}

/**
 * `payhere.js` for the onsite (popup/iframe) checkout. The sandbox serves the
 * same library path as live.
 */
export function getPayhereSdkUrl(): string {
  return `${getPayhereOrigin()}/lib/payhere.js`;
}

/** Base URL for the REST APIs (retrieval, refund, charging…). */
export function getPayhereRestBaseUrl(): string {
  return `${getPayhereOrigin()}/merchant/v1`;
}

export function getPayhereMerchantId(): string | null {
  const id = process.env.PAYHERE_MERCHANT_ID;
  return id && id.trim() !== "" ? id : null;
}

export function getPayhereAppCredentials(): {
  appId: string | null;
  appSecret: string | null;
} {
  return {
    appId: process.env.PAYHERE_APP_ID?.trim() || null,
    appSecret: process.env.PAYHERE_APP_SECRET?.trim() || null,
  };
}

export interface PayhereConfigStatus {
  /** Merchant id present. */
  merchantId: boolean;
  /** Merchant secret present — without it neither signature can be computed. */
  merchantSecret: boolean;
  /** REST API credentials present (retrieval/refund). */
  app: boolean;
  mode: PayhereMode;
  /** True when a redirect checkout can actually be initiated. */
  checkoutReady: boolean;
}

/**
 * Presence-only configuration report for the health endpoint. Never returns a
 * secret value — booleans only, so it is safe in any deployment's probe output.
 */
export function getPayhereConfigStatus(): PayhereConfigStatus {
  const merchantId = getPayhereMerchantId() !== null;
  const merchantSecret = Boolean(process.env.PAYHERE_MERCHANT_SECRET?.trim());
  const { appId, appSecret } = getPayhereAppCredentials();

  return {
    merchantId,
    merchantSecret,
    app: Boolean(appId && appSecret),
    mode: getPayhereMode(),
    checkoutReady: merchantId && merchantSecret,
  };
}

/**
 * Whether a checkout can be initiated. The webhook signature gate answers to
 * this too: with no secret we cannot verify anything, so we must not pretend a
 * payment succeeded.
 */
export function isPayhereConfigured(): boolean {
  return getPayhereConfigStatus().checkoutReady;
}
