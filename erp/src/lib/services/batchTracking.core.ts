/**
 * Batch Tracking Core — pure, dependency-free helpers for batch shelf-life.
 * Kept separate from the service so expiry logic is unit-testable without a DB.
 *
 * Expiry window policy:
 *   - expired   : expiryDate is in the past (<= now).
 *   - expiring  : within `EXPIRE_SOON_WINDOW_DAYS` (default 30) of expiring.
 *   - okay      : otherwise (including batches with no expiry date).
 */

export type BatchExpiryStatus = 'EXPIRED' | 'EXPIRING_SOON' | 'OK';

/** How many days ahead a batch is considered "expiring soon". */
export const EXPIRE_SOON_WINDOW_DAYS = 30;

/** Whole days from now until `expiryDate`. Negative means already expired. */
export function daysUntilExpiry(expiryDate: Date | null | undefined): number | null {
  if (!expiryDate) return null;
  return Math.floor((expiryDate.getTime() - Date.now()) / 86_400_000);
}

/**
 * Classify a batch by its expiry date.
 * A batch with no expiry date is treated as OK (not expiry-controlled).
 */
export function getBatchExpiryStatus(
  expiryDate: Date | null | undefined,
  now: Date = new Date(),
): BatchExpiryStatus {
  if (!expiryDate) return 'OK';

  const remainingMs = expiryDate.getTime() - now.getTime();
  const remainingDays = remainingMs / 86_400_000;

  if (remainingDays <= 0) return 'EXPIRED';
  if (remainingDays <= EXPIRE_SOON_WINDOW_DAYS) return 'EXPIRING_SOON';
  return 'OK';
}

/** True when the batch is expired or will expire within the warning window. */
export function isExpiryAlertNeeded(
  expiryDate: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  const status = getBatchExpiryStatus(expiryDate, now);
  return status === 'EXPIRED' || status === 'EXPIRING_SOON';
}

export function describeExpiryStatus(status: BatchExpiryStatus): string {
  switch (status) {
    case 'EXPIRED':
      return 'Expired';
    case 'EXPIRING_SOON':
      return 'Expiring soon';
    default:
      return 'Okay';
  }
}
