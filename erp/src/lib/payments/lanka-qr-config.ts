/**
 * LankaQR (LankaPay national QR) payment configuration.
 *
 * LankaQR is an EMVCo merchant-presented QR standard operated by LankaPay.
 * A merchant receives a static QR from their bank/finance company and the
 * customer scans it with any participating banking/wallet app, enters the
 * amount and confirms. This application does not talk to a QR terminal or
 * bank API, so the cashier confirms the payment manually.
 *
 * Everything a merchant needs to display (the QR image, merchant identity and
 * cashier instructions) is tenant-configurable and lives in
 * `Tenant.settings.lankaQr`. The parser below is deliberately defensive: the
 * settings column is free-form JSON and may contain legacy values.
 */

export interface LankaQrSettings {
  /** Show LankaQR as a tender option in the POS and back-office sale entry. */
  enabled: boolean;
  /** Trading name that appears in the customer's banking app. */
  merchantName: string;
  /** LankaPay merchant ID (MID) issued by the acquiring bank. */
  merchantId: string;
  /** Acquiring bank / finance company that issued the QR. */
  bankName: string;
  /** Static QR image (uploaded file URL or an absolute/root-relative URL). */
  qrImageUrl: string;
  /** Cashier-facing instruction shown above the confirmation button. */
  instructions: string;
  /** Require the cashier to enter the bank transaction reference. */
  referenceRequired: boolean;
  /** Allow LankaQR to be used as the digital leg of a split payment. */
  allowSplit: boolean;
}

export const DEFAULT_LANKA_QR_INSTRUCTIONS =
  'Ask the customer to scan the LankaQR code with their banking app, enter the amount and confirm. Check the bank confirmation before accepting the payment.';

export const DEFAULT_LANKA_QR_SETTINGS: LankaQrSettings = {
  // A tender that cannot be scanned must not be offered. It only becomes
  // available after the tenant stores a merchant name and QR image.
  enabled: false,
  merchantName: '',
  merchantId: '',
  bankName: '',
  qrImageUrl: '',
  instructions: DEFAULT_LANKA_QR_INSTRUCTIONS,
  referenceRequired: false,
  allowSplit: true,
};

function readString(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Coerce the persisted `settings.lankaQr` blob into a complete settings object.
 * Unknown keys are ignored and missing/invalid values fall back to safe
 * defaults, so callers never have to null-check individual fields.
 *
 * `enabled` is only honoured when the configuration is actually usable (a
 * merchant name and a renderable QR image). Legacy tenants that saved
 * `enabled: true` before this rule therefore stop offering an unscannable
 * LankaQR tender until they finish configuring it (ARGUS #509).
 */
export function parseLankaQrSettings(raw: unknown): LankaQrSettings {
  const source =
    typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};

  const instructions = readString(source.instructions, 240);
  const merchantName = readString(source.merchantName, 80);
  const qrImageUrl = readString(source.qrImageUrl, 2048);
  const requestedEnabled = readBoolean(source.enabled, DEFAULT_LANKA_QR_SETTINGS.enabled);
  const usable = merchantName.length > 0 && isRenderableQrImageUrl(qrImageUrl);

  return {
    enabled: requestedEnabled && usable,
    merchantName,
    merchantId: readString(source.merchantId, 40),
    bankName: readString(source.bankName, 80),
    qrImageUrl,
    instructions: instructions || DEFAULT_LANKA_QR_SETTINGS.instructions,
    referenceRequired: readBoolean(
      source.referenceRequired,
      DEFAULT_LANKA_QR_SETTINGS.referenceRequired,
    ),
    allowSplit: readBoolean(source.allowSplit, DEFAULT_LANKA_QR_SETTINGS.allowSplit),
  };
}

/** Extract the LankaQR block from a tenant `settings` JSON value. */
export function readLankaQrSettingsFromTenantSettings(settings: unknown): LankaQrSettings {
  const source =
    typeof settings === 'object' && settings !== null
      ? (settings as Record<string, unknown>)
      : {};
  return parseLankaQrSettings(source.lankaQr);
}

/** A QR image is only renderable when it points at an http(s) or root-relative URL. */
export function isRenderableQrImageUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/')) return true;
  return /^https?:\/\/\S+$/i.test(trimmed);
}
