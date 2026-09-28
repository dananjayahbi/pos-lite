import {
  AlertTriangle,
  Banknote,
  Boxes,
  CalendarClock,
  CalendarX2,
  CheckCircle2,
  ClipboardList,
  Clock,
  Hourglass,
  Info,
  PackageCheck,
  PackageMinus,
  PackageX,
  RotateCcw,
  Scale,
  Send,
  ShieldAlert,
  ShoppingCart,
  Truck,
  Wallet,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import type { NotificationType } from '@/generated/prisma/client';

/**
 * M32-02 (OBS-59) — single icon source for notification rows.
 *
 * OBS-59 found the `TYPE_ICONS` map covering only 6 of the enum's values, with
 * everything else falling back to a generic `Info` icon. It had also already
 * **drifted**: the `/notifications` page and the header `NotificationPopover`
 * each kept a private map, and the popover knew three types the page did not.
 *
 * Both now read this one table, so they can no longer disagree. The map is typed
 * `Record<NotificationType, LucideIcon>` — exhaustive by construction, so adding
 * a 22nd value to the Prisma enum makes `tsc` fail here instead of silently
 * degrading to the fallback icon.
 *
 * `type`-only import of the enum: a value import would pull the Prisma runtime
 * into these client bundles.
 */
export const NOTIFICATION_TYPE_ICONS: Record<NotificationType, LucideIcon> = {
  // Stock
  LOW_STOCK_ALERT: AlertTriangle,
  STOCK_TAKE_SUBMITTED: ClipboardList,
  STOCK_TAKE_APPROVED: CheckCircle2,
  STOCK_TAKE_REJECTED: XCircle,
  SYSTEM_ALERT: Info,
  // Sales / shifts / cash
  SALE_COMPLETED: ShoppingCart,
  RETURN_PROCESSED: RotateCcw,
  SHIFT_CLOSED: Clock,
  PETTY_CASH_LOW: Wallet,
  COD_PENDING_ALERT: Banknote,
  // Delivery
  DELIVERY_STATUS_UPDATED: Truck,
  DELIVERY_FAILED: PackageX,
  DELIVERY_DISPATCHED: Send,
  DELIVERY_DELIVERED: PackageCheck,
  DELIVERY_HELD_EXPIRING: Hourglass,
  // Packaging / reconciliation
  PACKAGING_LOW_STOCK: PackageMinus,
  RECONCILIATION_DISCREPANCY: Scale,
  // Manufacturing (raw materials / batches)
  RAW_MATERIAL_LOW_STOCK: Boxes,
  RAW_MATERIAL_CRITICAL: ShieldAlert,
  BATCH_EXPIRY_SOON: CalendarClock,
  BATCH_EXPIRED: CalendarX2,
};

/**
 * Fallback for a `type` string that is not a known enum member.
 *
 * Still reachable at runtime: rows may carry a type written before an enum
 * change, and the components accept a plain `string`. A missing icon is
 * cosmetic — never a crash.
 */
export const DEFAULT_NOTIFICATION_ICON: LucideIcon = Info;

/** Resolve the display icon for a notification type, with a safe fallback. */
export function getNotificationIcon(type: string): LucideIcon {
  return NOTIFICATION_TYPE_ICONS[type as NotificationType] ?? DEFAULT_NOTIFICATION_ICON;
}

/**
 * OBS-58 (documentation only — no behaviour change): per-role notification
 * targeting is producer-driven, not decided here. Every producer resolves a
 * tenant-scoped recipient list and fans out one row per recipient
 * (e.g. `shifts/[id]/close` collects an OWNER/MANAGER audience and
 * `notificationRecord.createMany`s per recipient). "All live rows target the
 * owner" is therefore a property of the seeded fixture, not a routing defect;
 * only the OWNER audience is currently exercised by the test data.
 */