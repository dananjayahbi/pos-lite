/**
 * @deprecated Superseded by `src/lib/payments/payhere-crypto.ts`.
 *
 * This module used the CHECKOUT-hash formula for the IPN gate, omitting
 * `status_code` from the digest — which meant every genuine PayHere payment
 * notification failed verification. The corrected implementation (both
 * signatures, side by side) lives in `@/lib/payments/payhere-crypto`; the
 * names are re-exported here so any remaining import keeps resolving, and no
 * caller can accidentally reach the wrong formula again.
 *
 * New code MUST import from `@/lib/payments/payhere-crypto`.
 */

export {
  computeCheckoutHash,
  computeInnerHash,
  computeIpnSignature,
  formatPayhereAmount,
  getPayhereMerchantSecret,
  resetSecretWarningThrottle,
  SECRET_WARNING_THROTTLE_MS,
  verifyPayhereSignature,
  warnSecretNotConfigured,
} from "@/lib/payments/payhere-crypto";

export type {
  PayhereIpnSignatureInput,
  PayhereSignatureBase,
  PayhereSignaturePayload,
  PayhereSignatureRejection,
  PayhereSignatureResult,
} from "@/lib/payments/payhere-crypto";
