# LankaQR payments

LankaQR is Sri Lanka's national **merchant-presented QR** (EMVCo MPM) payment
standard, operated by LankaPay. A merchant receives a static QR from their
bank/finance company; the customer scans it with any participating banking or
wallet app, enters the amount and confirms. Settlement goes directly to the
merchant's bank account (typically at a bank fee capped around 1%).

The POS does **not** connect to a bank/QR terminal API. LankaQR is a cashier-
confirmed tender: the cashier displays the merchant QR, verifies the customer's
successful payment, optionally records the bank reference, and confirms the
sale.

## Where it is available

| Surface | Behaviour |
| --- | --- |
| POS terminal (`/pos`) | “LankaQR” tender in the Charge/Pay menu; full-screen payment modal with the merchant QR, total due and optional/required reference. |
| Split payment | LankaQR can be the digital leg alongside a cash leg (configurable). |
| Back-office sale entry (`/sales` → Record Sale) | “LANKAQR” tender option in the payment-method grid. |
| Sale history / sale detail / returns history | `LANKAQR` rows, filter option and badges. |
| Shift Z-report (`/pos/shift-report`, printed) | Separate “LankaQR Sales” total (never lumped into card). |
| Receipt printer | Prints the LankaQR tender line. |

Online storefront orders are **not** included: the storefront uses PayHere for
card payments. A dynamic, amount-embedded LankaQR for online checkout requires a
bank/gateway integration and is out of scope for the static-QR tender.

## Configuration

Owner/manager: **Settings → Payments & LankaQR** (`/settings/payments`).

Stored in `Tenant.settings.lankaQr`:

```json
{
  "enabled": true,
  "merchantName": "AyurPOS Colombo",
  "merchantId": "MID issued by the bank",
  "bankName": "Acquiring bank",
  "qrImageUrl": "https://cdn.example.com/lankaqr.png",
  "instructions": "Ask the customer to scan …",
  "referenceRequired": false,
  "allowSplit": true
}
```

- `enabled` hides the tender everywhere when false.
- `qrImageUrl` accepts an `http(s)` URL or an uploaded root-relative path
  (`/uploads/...`). The modal renders it as the merchant QR.
- `referenceRequired` blocks confirmation until the cashier enters the bank
  reference.
- `allowSplit` controls whether LankaQR appears as the digital leg of a split
  payment.

The settings are read server-side in the POS layout
(`readLankaQrSettingsFromTenantSettings`) and sent to the cart. The back-office
sale sheet reads `GET /api/settings/payments`. Unconfigured tenants fall back to
sane defaults (enabled, no image, default instructions); the modal then shows a
“no static QR configured” prompt instead of a broken image.

Permissions: `settings:payments`. OWNER and MANAGER hold it; CASHIER does not.
Cashiers still see the tender because the POS layout resolves the config for
them server-side.

## API

- `PATCH /api/store/sales` with `paymentMethod: "LANKAQR"` records the sale and
  a `Payment` row with method `LANKAQR`.
- `PATCH /api/settings/payments` saves the configuration block (full object).
- `GET /api/settings/payments` returns the configuration for back-office forms.

## Tests

- `src/lib/payments/__tests__/lanka-qr-config.test.ts` — parsing/defaults/URL
  safety.
- `src/lib/services/__tests__/paymentBreakdown.test.ts` — LankaQR is reported
  separately from cash and card in Z-reports.
- `src/lib/services/__tests__/saleAccounts.test.ts` — LankaQR sales post to the
  gateway payment account.
- `src/lib/validators/__tests__/sale.validators.test.ts` — split sale with a
  LankaQR leg is accepted.
