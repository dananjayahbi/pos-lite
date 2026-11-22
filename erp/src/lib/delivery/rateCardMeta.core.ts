import { formatShortDateTime } from '@/lib/format';
import { staffDisplayName } from '@/lib/utils/staff-name';

/**
 * ARGUS #295 - saving a rate card applies immediately to every quote, but the
 * page never showed when or by whom the card last changed. This metadata lives
 * in `Tenant.settings.delivery.rateCardMeta` (no schema change).
 */
export interface RateCardMeta {
  updatedAt: string | null;
  updatedByEmail: string | null;
  updatedByRole: string | null;
  /** Which editor wrote last: the base card or the zone matrix. */
  action: 'card' | 'entries' | null;
}

export const EMPTY_RATE_CARD_META: RateCardMeta = {
  updatedAt: null,
  updatedByEmail: null,
  updatedByRole: null,
  action: null,
};

export function rateCardMetaSummary(meta: RateCardMeta | null | undefined): string {
  if (!meta?.updatedAt) {
    return 'Rates have not been changed since the card was created.';
  }
  const what = meta.action === 'entries' ? 'Zone overrides updated' : 'Base rates updated';
  const who = meta.updatedByEmail
    ? `${staffDisplayName(meta.updatedByEmail)}${meta.updatedByRole ? ` (${meta.updatedByRole.replace(/_/g, ' ').toLowerCase()})` : ''}`
    : 'an unknown user';
  return `${what} ${formatShortDateTime(meta.updatedAt)} by ${who}. Effective immediately for new quotes and new or edited deliveries.`;
}
