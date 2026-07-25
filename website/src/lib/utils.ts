import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Conditionally merge class names with Tailwind-aware dedup.
 *
 * Use everywhere a `className` prop is accepted to safely combine defaults
 * with caller overrides without producing conflicting utility classes.
 *
 * @example
 *   <div className={cn('p-4 text-sm', isActive && 'bg-primary', className)} />
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Build an absolute URL from the ERP backend base + a relative path.
 * Returns null when the base URL is not configured.
 */
export function buildApiUrl(base: string | undefined, path: string): string | null {
  if (!base) return null;
  const trimmedBase = base.replace(/\/$/, '');
  const trimmedPath = path.startsWith('/') ? path : `/${path}`;
  return `${trimmedBase}${trimmedPath}`;
}

/**
 * Format a price in LKR with thousands separators.
 */
export function formatLKR(amount: number | string): string {
  const num = typeof amount === 'string' ? Number.parseFloat(amount) : amount;
  if (!Number.isFinite(num)) return 'Rs. 0';
  return `Rs. ${num.toLocaleString('en-LK', { maximumFractionDigits: 0 })}`;
}

/**
 * Truncate a string to a maximum length, appending an ellipsis if cut.
 */
export function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}