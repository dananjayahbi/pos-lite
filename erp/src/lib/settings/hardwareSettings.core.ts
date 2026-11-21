/**
 * ARGUS #510 — hardware/printer settings shape normalisation + audit payload.
 *
 * The tenant settings blob has been written in two shapes over time:
 *
 *   settings.hardware.printer = { type, host, port }   (canonical, PATCH)
 *   settings.hardware         = { type, host, port }   (flat seed/legacy)
 *
 * The settings page only read the nested shape, so a tenant seeded with the
 * flat shape saw a blank host/port and could not save. These helpers read both
 * shapes (nested wins) and build the audited before/after snapshot.
 *
 * Pure: no prisma, no `server-only`, shared by the page, the route and tests.
 */

export type PrinterType = 'NETWORK' | 'USB';

export interface HardwareSettingsSnapshot {
  printerType: PrinterType;
  host: string;
  port: number;
  cashDrawerEnabled: boolean;
  cfdEnabled: boolean;
}

export interface HardwareSettingsUpdate {
  printerType?: PrinterType | undefined;
  host?: string | undefined;
  port?: number | undefined;
  cashDrawerEnabled?: boolean | undefined;
  cfdEnabled?: boolean | undefined;
}

const DEFAULT_PORT = 9100;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function firstDefined(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null);
}

function readPrinterType(value: unknown): PrinterType | null {
  if (typeof value !== 'string') return null;
  const normalised = value.trim().toUpperCase();
  if (normalised === 'USB') return 'USB';
  if (normalised === 'NETWORK') return 'NETWORK';
  return null;
}

function readPort(value: unknown): number | null {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : NaN;
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 65535) return null;
  return numeric;
}

/** Read hardware settings from either the nested or the flat stored shape. */
export function readHardwareSettings(settings: unknown): HardwareSettingsSnapshot {
  const root = asRecord(settings);
  const hardware = asRecord(root.hardware);
  const printer = asRecord(hardware.printer);

  const printerType =
    readPrinterType(printer.type) ?? readPrinterType(hardware.type) ?? 'NETWORK';
  const rawHost = firstDefined(printer.host, hardware.host);
  const host = typeof rawHost === 'string' ? rawHost.trim() : '';
  const port =
    readPort(printer.port) ?? readPort(hardware.port) ?? DEFAULT_PORT;

  return {
    printerType,
    host,
    port,
    cashDrawerEnabled: hardware.cashDrawerEnabled === true,
    cfdEnabled: hardware.cfdEnabled === true,
  };
}

/**
 * Apply a PATCH-style update to the current snapshot. Omitted fields keep the
 * stored value; an explicit empty host stays empty (the caller decides whether
 * that is valid for the selected printer type).
 */
export function mergeHardwareSettings(
  current: HardwareSettingsSnapshot,
  update: HardwareSettingsUpdate,
): HardwareSettingsSnapshot {
  return {
    printerType: update.printerType ?? current.printerType,
    host: update.host !== undefined ? update.host.trim() : current.host,
    port: update.port ?? current.port,
    cashDrawerEnabled: update.cashDrawerEnabled ?? current.cashDrawerEnabled,
    cfdEnabled: update.cfdEnabled ?? current.cfdEnabled,
  };
}

/**
 * The network host is only required when the effective printer type is
 * NETWORK. USB printers deliberately allow a blank host.
 */
export function validateHardwareSettings(
  snapshot: HardwareSettingsSnapshot,
): string | null {
  if (snapshot.printerType === 'NETWORK' && snapshot.host.trim() === '') {
    return 'Host is required for network printers';
  }
  return null;
}

/** Explicit hardware-only audit snapshot; unrelated settings never leak. */
export function hardwareSettingsAuditPayload(
  before: HardwareSettingsSnapshot,
  after: HardwareSettingsSnapshot,
): { before: HardwareSettingsSnapshot; after: HardwareSettingsSnapshot } {
  const snapshot = (value: HardwareSettingsSnapshot): HardwareSettingsSnapshot => ({
    printerType: value.printerType,
    host: value.host,
    port: value.port,
    cashDrawerEnabled: value.cashDrawerEnabled,
    cfdEnabled: value.cfdEnabled,
  });
  return { before: snapshot(before), after: snapshot(after) };
}
