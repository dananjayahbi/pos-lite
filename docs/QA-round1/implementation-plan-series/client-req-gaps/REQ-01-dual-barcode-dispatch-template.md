# REQ-01 — Req 2.3: custom branded print invoice/dispatch template with DUAL barcode (top-right + center courier label)

**Severity:** P2 (client req, unbuilt half) · **Type:** client-requirement gap · **Depends on:** M24-01 (real waybills), M07 (printer hardware path verified) · **Refs:** `REFERENCES/delivery-integration-plan/07-custom-shipping-label-designer.md`

## Verified source state (2026-09-15)
- A **label designer exists**: `src/app/(store)/delivery/label/LabelDesignerClient.tsx` (68 lines) + `page.tsx`, config model in `src/lib/constants/label.ts` (`showBarcodes: true` at :48) + `src/lib/validators/label.validators.ts` (boolean toggle at :20). Receipt generation: `src/lib/receipt-renderer.ts` (thermal HTML, authenticated endpoint verified in Module 14).
- **The gap vs req 2.3:** (a) no "Ruhunu Wedagedara" prominent header/logo treatment verified on the dispatch layout; (b) **dual-barcode placement** — Barcode #1 top-right, Barcode #2 center for courier scanning — is not a modeled concept; `showBarcodes` is a global on/off, not per-position slots; (c) enlarged bold customer delivery details not a styled block; (d) whether the label prints the **waybill barcode** (from courier upload, M24-01) vs the internal SKU barcode is unresolved — today there are no shipments to print.

## Fix approach
1. Extend the label config schema: `barcodes: [{ value: 'WAYBILL'|'ORDER_REF'|'SKU', position: 'TOP_RIGHT'|'CENTER', size }]` (validators + designer UI — grow `LabelDesignerClient` into small subcomponents, don't inline).
2. Branded dispatch template preset: tenant logo (from superadmin settings branding, M08 F4 fields) + bold delivery-details block + the two barcode slots defaulted per client spec.
3. Wire the waybill value from `CourierShipment.waybillId` once dispatch works (M24-01) — until then, order-ref barcode renders (testable).
4. Thermal sales-receipt header: confirm `receipt-renderer.ts` prints the logo/siteName prominently (receiptFooter exists at :84-86; logo likely not) — add logo block.
5. Print-output verification remains hardware-dependent (OBS-25) — acceptance is HTML/PDF inspection + one manual print check.

## Acceptance / gate
- New `tests/24`-adjacent or a focused spec: label endpoint returns HTML containing two barcode SVGs at the configured positions with waybill/order-ref values; req 2.3 bullets tickable (except physical print).
