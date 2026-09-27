import { createHash } from "crypto";

/**
 * PayHere cryptographic primitives — the single implementation of both
 * PayHere signatures.
 *
 * There are TWO signatures in the PayHere checkout flow and they are **not**
 * the same. Getting them confused is silent: a wrong checkout `hash` makes the
 * gateway answer "Unauthorized Payment Request", and a wrong IPN `md5sig`
 * makes every genuine payment notification fail our gate.
 *
 *   inner    = UPPER(MD5(merchant_secret))
 *   hash     = UPPER(MD5(merchant_id + order_id + amount + currency + inner))
 *   md5sig   = UPPER(MD5(merchant_id + order_id + payhere_amount +
 *                        payhere_currency + status_code + inner))
 *
 * ⚠ `inner` uppercases the **hex digest of the secret** — NOT the secret itself
 * before hashing. `md5(secret.toUpperCase())` is a DIFFERENT value and the
 * gateway answers "Unauthorized payment request" for it. The two coincide only
 * when the secret happens to be all-uppercase, which is why this is easy to get
 * wrong and invisible in testing. Every language sample on the vendor's page
 * agrees (PHP `strtoupper(md5($secret))`, JS
 * `md5(secret).toString().toUpperCase()`, .NET `{b:X2}`, Java hex + `toUpperCase`).
 *
 * Deliberately dependency-free (no prisma, no `server-only`) so it runs in the
 * Node runtime of a route and in vitest's node environment alike.
 */

/** Why an IPN was rejected. `null` on the result means "verified". */
export type PayhereSignatureRejection =
  | "SECRET_NOT_CONFIGURED"
  | "BAD_SIGNATURE";

/**
 * Verification outcome. Modeled as a discriminated union so `reason` is
 * provably `null` for a verified IPN and provably one of the two codes for a
 * rejected one (callers get the narrowing for free).
 */
export type PayhereSignatureResult =
  | { valid: true; reason: null }
  | { valid: false; reason: PayhereSignatureRejection };

/** Fields shared by both signature inputs. */
export interface PayhereSignatureBase {
  /** `merchant_id` */
  merchantId: string;
  /** `order_id` */
  orderId: string;
  /** The amount string exactly as sent/received (2 decimals). */
  amount: string;
  /** `currency` on checkout, `payhere_currency` on the IPN. */
  currency: string;
}

/** Fields of an IPN signature input: the shared base plus `status_code`. */
export interface PayhereIpnSignatureInput extends PayhereSignatureBase {
  /** `status_code` — present only on the IPN, never on the checkout form. */
  statusCode: string;
}

/** The IPN form fields the md5sig is verified from (snake_case are the raw
 *  gateway field names the route parses). */
export interface PayhereSignaturePayload extends PayhereIpnSignatureInput {
  /** `md5sig` — the signature the gateway sent, to verify against. */
  md5sig: string;
}

/** Throttle window for the unconfigured-secret warning: at most one log line
 *  (and therefore one Sentry event) per window, however hard IPNs flood in. */
export const SECRET_WARNING_THROTTLE_MS = 5 * 60 * 1000;

const md5 = (value: string): string =>
  createHash("md5").update(value).digest("hex");

/**
 * PayHere's shared inner hash: `UPPER(MD5(merchant_secret))`.
 *
 * Uppercase is applied to the HEX DIGEST of the secret, not to the secret
 * itself before hashing (`md5(secret.toUpperCase())` is a different value and
 * the gateway rejects it). Kept in one exported function so the checkout hash
 * and the IPN signature can never drift from this rule.
 */
export function computeInnerHash(secret: string): string {
  return md5(secret).toUpperCase();
}

/**
 * The checkout `hash` sent **to** PayHere with the payment form. Required
 * since 2023-01-16. Must be generated server-side — a browser-side hash would
 * expose the merchant secret.
 */
export function computeCheckoutHash(
  secret: string,
  input: PayhereSignatureBase,
): string {
  return md5(
    input.merchantId +
      input.orderId +
      input.amount +
      input.currency +
      computeInnerHash(secret),
  ).toUpperCase();
}

/**
 * The IPN `md5sig` received **from** PayHere. Identical to the checkout hash
 * except that `status_code` is included in the outer concatenation.
 */
export function computeIpnSignature(
  secret: string,
  input: PayhereIpnSignatureInput,
): string {
  return md5(
    input.merchantId +
      input.orderId +
      input.amount +
      input.currency +
      input.statusCode +
      computeInnerHash(secret),
  ).toUpperCase();
}

/**
 * Format an amount the way PayHere's own samples do:
 * `number_format($amount, 2, '.', '')` — always two decimals, never thousands
 * separators. The value used to build the hash MUST be the value submitted.
 */
export function formatPayhereAmount(amount: number | string): string {
  const numeric = typeof amount === "number" ? amount : Number.parseFloat(amount);
  if (!Number.isFinite(numeric)) {
    throw new TypeError(`Cannot format a non-numeric PayHere amount: ${amount}`);
  }
  return Math.abs(numeric).toFixed(2);
}

/**
 * The configured merchant secret, or `null` when it is absent/blank.
 *
 * A whitespace-only value counts as NOT configured (an `.env` line like
 * `PAYHERE_MERCHANT_SECRET=" "` is a misconfiguration, not a secret), but a
 * real secret is returned untouched so hashing is unchanged.
 */
export function getPayhereMerchantSecret(): string | null {
  const secret = process.env.PAYHERE_MERCHANT_SECRET;
  if (!secret || secret.trim() === "") return null;
  return secret;
}

let lastSecretWarningAt = 0;

/**
 * Emit the "secret is not configured" warning at most once per
 * `SECRET_WARNING_THROTTLE_MS`. Returns `true` when this call actually logged
 * (i.e. it was not throttled) so callers/tests can observe the throttle.
 *
 * With the secret unset the expected signature is derived from an empty secret,
 * so every real IPN fails the gate — the failure must be loud in logs/Sentry
 * rather than a silent always-200.
 */
export function warnSecretNotConfigured(now: number = Date.now()): boolean {
  if (
    lastSecretWarningAt !== 0 &&
    now - lastSecretWarningAt < SECRET_WARNING_THROTTLE_MS
  ) {
    return false;
  }
  lastSecretWarningAt = now;
  console.warn(
    "[PayHere IPN] PAYHERE_MERCHANT_SECRET is not configured — every IPN will fail the signature gate " +
      "(reason SECRET_NOT_CONFIGURED) and no payment will ever be recorded. " +
      `Set PAYHERE_MERCHANT_SECRET; this warning is throttled to one per ${SECRET_WARNING_THROTTLE_MS / 1000}s.`,
  );
  return true;
}

/** Test hook: clear the warning throttle so both paths are assertable. */
export function resetSecretWarningThrottle(): void {
  lastSecretWarningAt = 0;
}

/**
 * Verify a PayHere IPN `md5sig`.
 *
 * - secret unset                  → `{ valid:false, reason:'SECRET_NOT_CONFIGURED' }`
 * - signature does not match      → `{ valid:false, reason:'BAD_SIGNATURE' }`
 * - signature matches             → `{ valid:true,  reason:null }`
 *
 * The comparison is exact, not case-insensitive: both sides are uppercase hex
 * because the contract uppercases the digest. Accepting arbitrary casing would
 * widen the gate for no benefit, since PayHere only ever sends uppercase.
 *
 * Verifying the signature is what makes a "payment succeeded" notification
 * trustworthy — without it a third party could POST a forged success.
 */
export function verifyPayhereSignature(
  payload: PayhereSignaturePayload,
): PayhereSignatureResult {
  const secret = getPayhereMerchantSecret();

  if (secret === null) {
    warnSecretNotConfigured();
    return { valid: false, reason: "SECRET_NOT_CONFIGURED" };
  }

  const expectedSig = computeIpnSignature(secret, payload);

  if (expectedSig === payload.md5sig) {
    return { valid: true, reason: null };
  }

  return { valid: false, reason: "BAD_SIGNATURE" };
}
