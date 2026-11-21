# LankaQR requires a scannable QR (ARGUS #72)

LankaQR is a merchant-presented static QR: the customer scans the shop's
bank-issued image and the cashier confirms manually. Without an image there is
nothing to scan, so the tender must not be usable.

## Rule

`lankaQrTenderRejection()` (`src/lib/payments/lanka-qr-config.ts`) is the single
predicate. For `paymentMethod = LANKAQR` (or a `SPLIT` sale whose
`splitLegMethod = LANKAQR`) it returns a rejection reason when:

- no renderable `qrImageUrl` or no merchant name is configured;
- the tenant has LankaQR disabled;
- a split leg is requested while `allowSplit` is off.

Other tenders return `null` and are untouched.

## Enforcement points

- **POS tender chooser:** the option only appears when `settings.enabled`, which
  `parseLankaQrSettings()` derives from a usable merchant name + QR URL.
- **LankaQR dialog:** the Confirm button is disabled and `handleSubmit()` refuses
  when no QR image is renderable; the warning panel says LankaQR cannot be
  accepted. There is no bypass via the optional reference field.
- **Sale API:** `POST /api/store/sales` loads the tenant's `settings.lankaQr` and
  returns `422 LANKAQR_NOT_CONFIGURED` before `createSale()` for any LankaQR
  tender. A stale tab or direct request cannot record an unpayable QR sale.

## Verification

`src/lib/payments/__tests__/lanka-qr-config.test.ts` covers direct and split-leg
tenders, the unconfigured/disabled/split-disallowed cases and the allowed case.
