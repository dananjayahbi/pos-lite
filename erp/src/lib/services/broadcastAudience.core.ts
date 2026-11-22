/**
 * Broadcast audience cap (ARGUS #320).
 *
 * The legacy WhatsApp route capped a send at 200 recipients; the current
 * `/api/broadcast/send` path did not, so a mis-set filter could queue the whole
 * customer book to a paid provider in one request. The cap is a policy value,
 * kept pure so the route and its test share it.
 */

export const BROADCAST_MAX_RECIPIENTS = 200;

export function isBroadcastAudienceTooLarge(total: number): boolean {
  return Number.isFinite(total) && total > BROADCAST_MAX_RECIPIENTS;
}

export function broadcastAudienceLimitMessage(total: number): string {
  return `This audience has ${total} recipients; the maximum per broadcast is ${BROADCAST_MAX_RECIPIENTS}. Narrow the filters and try again.`;
}
