/**
 * Promotion live state (ARGUS #329).
 *
 * The list used to count `isActive` alone, so a promotion whose window is in
 * the future or already over still read as "active". This pure helper is the
 * single source of truth for the four merchant-facing states and for every
 * count on the promotions / customer-pricing UI:
 *
 *  - `ENABLED`    - switched on and has no date window (always applies)
 *  - `SCHEDULED`  - switched on, start is in the future
 *  - `ACTIVE_NOW` - switched on, current instant is inside the window
 *  - `EXPIRED`    - switched on, end is in the past
 *  - `INACTIVE`   - the master switch is off (never applies)
 *
 * "Live" therefore means `ENABLED` or `ACTIVE_NOW`. `INACTIVE` is kept as a
 * separate internal state so an off row is not mislabelled Scheduled/Expired.
 * Invalid legacy dates are treated as an open bound rather than crashing the
 * list.
 */

export type PromotionLiveState =
  | 'INACTIVE'
  | 'ENABLED'
  | 'SCHEDULED'
  | 'ACTIVE_NOW'
  | 'EXPIRED';

export interface PromotionLiveRow {
  isActive: boolean;
  startsAt: Date | string | null;
  endsAt: Date | string | null;
}

export const PROMOTION_LIVE_STATE_LABELS: Record<PromotionLiveState, string> = {
  INACTIVE: 'Inactive',
  ENABLED: 'Enabled',
  SCHEDULED: 'Scheduled',
  ACTIVE_NOW: 'Active now',
  EXPIRED: 'Expired',
};

function toTime(value: Date | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

/** Classify one promotion/rule row at `now`. */
export function getPromotionLiveState(
  row: PromotionLiveRow,
  now: Date = new Date(),
): PromotionLiveState {
  if (!row.isActive) return 'INACTIVE';

  const nowTime = now.getTime();
  const start = toTime(row.startsAt);
  const end = toTime(row.endsAt);

  // Expired wins over a malformed future-start/past-end pair: the end bound is
  // the one that makes the row stop applying.
  if (end !== null && end < nowTime) return 'EXPIRED';
  if (start !== null && start > nowTime) return 'SCHEDULED';
  if (start === null && end === null) return 'ENABLED';
  return 'ACTIVE_NOW';
}

/** True for states that apply to a cart right now. */
export function isPromotionLive(state: PromotionLiveState): boolean {
  return state === 'ENABLED' || state === 'ACTIVE_NOW';
}

export interface PromotionLiveCounts {
  inactive: number;
  enabled: number;
  scheduled: number;
  activeNow: number;
  expired: number;
  /** Enabled + active now: the rows that really apply at `now`. */
  live: number;
}

/** Count every state in one pass; `live` is the honest "active now" number. */
export function summarizePromotionLiveStates(
  rows: readonly PromotionLiveRow[],
  now: Date = new Date(),
): PromotionLiveCounts {
  const counts: PromotionLiveCounts = {
    inactive: 0,
    enabled: 0,
    scheduled: 0,
    activeNow: 0,
    expired: 0,
    live: 0,
  };

  for (const row of rows) {
    switch (getPromotionLiveState(row, now)) {
      case 'INACTIVE':
        counts.inactive += 1;
        break;
      case 'ENABLED':
        counts.enabled += 1;
        counts.live += 1;
        break;
      case 'SCHEDULED':
        counts.scheduled += 1;
        break;
      case 'ACTIVE_NOW':
        counts.activeNow += 1;
        counts.live += 1;
        break;
      case 'EXPIRED':
        counts.expired += 1;
        break;
    }
  }

  return counts;
}
