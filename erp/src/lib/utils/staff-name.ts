/**
 * Human-readable staff names.
 *
 * The User model stores an email address only (no name column), so reports that
 * need a person label derive one from the mailbox local part:
 *
 *   owner@dilani-ayurwellness.lk → "Owner"
 *   cashier1@ayurpos.dev         → "Cashier 1"
 *   stock.clerk@shop.lk          → "Stock Clerk"
 *
 * The original email stays available for tooltips and audit surfaces.
 */
export function staffDisplayName(email: string | null | undefined): string {
  if (!email) return 'Unknown';

  const localPart = email.split('@')[0] ?? '';
  const tokens = localPart
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .split(/[._\-+\s]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) return email;

  return tokens
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(' ');
}
