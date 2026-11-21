/**
 * ARGUS #56 — one relative/absolute time label for notification rows.
 *
 * The list page and the header popover each had a private copy of this helper,
 * and both fell back to the runtime locale (`toLocaleDateString()`), which
 * renders old rows as `10/28/2026` on a US-locale device. Older rows now use
 * the same day-first `28 Oct 2026` style as the rest of the app.
 */

import { formatDisplayDate } from '@/lib/format';

export function formatNotificationTime(dateStr: string, now: number = Date.now()): string {
  const date = new Date(dateStr).getTime();
  if (!Number.isFinite(date)) return '';

  const diff = Math.max(0, now - date);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return formatDisplayDate(dateStr);
}
